// js/app.js - Modern Gym Tracker Application - FIXED VERSION

// ===== AUDIO FUNCTIONS =====
function playBeep() {
    const beep = document.getElementById('sound-beep');
    if (beep) {
        beep.currentTime = 0;
        beep.volume = 0.2;
        beep.play().catch(() => {}); // Ignore audio errors
    }
}

function playDone() {
    const done = document.getElementById('sound-done');
    if (done) {
        done.currentTime = 0;
        done.volume = 0.4;
        done.play().catch(() => {}); // Ignore audio errors
    }
}

// ===== MAIN APP CLASS =====
class GymTracker {
    constructor() {
        // State variables
        this.currentPage = 'home';
        this.currentWorkout = null;
        this.currentTemplate = null;
        this.selectedExercises = [];
        this.selectedExerciseIds = [];
        this.workoutTimer = null;
        this.restTimer = null;
        this.setRestIntervals = {};
        this.editingExerciseId = null;
        this.tempImageData = null;
        this.tempImageType = 'upload';
        this.imagePreviewTimeout = null;

        // Load data from localStorage
        this.templates = this.loadData('templates') || [];
        this.exercises = this.loadData('exercises') || this.getDefaultExercises();
        this.workoutHistory = this.loadData('workoutHistory') || [];
        
        // Merge default exercises if needed
        this.mergeDefaultExercises();
        
        // Search states
        this.currentExerciseSearch = '';
        this.exerciseSelectSearchValue = '';

        // Initialize managers
        this.supersetManager = new SupersetManager();
        this.exerciseLibrary = new ExerciseLibrary();
        this.exerciseLibrary.exercises = this.exercises;
        this.notifications = new NotificationManager();
        
        // Initialize app
        this.init();
    }

    // ===== INITIALIZATION =====
    init() {
        this.setupEventListeners();
        this.loadPage(this.currentPage);
        this.updateStats();
        
        // Save default exercises if needed
        if (!this.loadData('exercises')) {
            this.saveData('exercises', this.exercises);
        }
    }

    getAnalytics() {
        if (!this.analytics && window.AdvancedAnalytics) {
            try {
                this.analytics = new AdvancedAnalytics(this);
            } catch (error) {
                console.error('Analytics failed to load:', error);
                return null;
            }
        }
        return this.analytics;
    }

    mergeDefaultExercises() {
        const defaultExercises = this.getDefaultExercises();
        const userExercises = this.exercises;
        const userIds = userExercises.map(ex => ex.id);
        let added = false;
        
        defaultExercises.forEach(defEx => {
            if (!userIds.includes(defEx.id)) {
                userExercises.push(defEx);
                added = true;
            }
        });
        
        if (added) {
            this.saveData('exercises', userExercises);
        }
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.dataset.page;
                this.loadPage(page);
            });
        });

        // Mobile menu toggle
        const menuToggle = document.getElementById('menu-toggle');
        if (menuToggle) {
            menuToggle.addEventListener('click', () => {
                menuToggle.classList.toggle('active');
            });
        }

        // Notification settings
        const notificationToggle = document.getElementById('enable-notifications');
        if (notificationToggle) {
            notificationToggle.checked = localStorage.getItem('gymTracker_notifications') !== '0';
            notificationToggle.addEventListener('change', function() {
                localStorage.setItem('gymTracker_notifications', this.checked ? '1' : '0');
            });
        }

        // Search inputs
        document.getElementById('template-search')?.addEventListener('input', (e) => {
            this.filterTemplates(e.target.value);
        });
        
        document.getElementById('exercise-search')?.addEventListener('input', (e) => {
            this.filterExercises(e.target.value);
        });
        
        document.getElementById('exercise-select-search')?.addEventListener('input', (e) => {
            this.currentExerciseSearch = e.target.value;
            this.filterExerciseSelection(e.target.value);
        });
        
        // Filter selects
        document.getElementById('template-filter')?.addEventListener('change', (e) => {
            this.filterTemplates('', e.target.value);
        });
        
        document.getElementById('muscle-filter')?.addEventListener('change', (e) => {
            this.filterExercises('', e.target.value);
        });

        document.getElementById('equipment-filter')?.addEventListener('change', (e) => {
            this.filterExercises();
        });
    }

    // ===== MENU FUNCTIONS - FINAL FIXED VERSION =====
    toggleExerciseMenu(event, context, exIndex) {
        event.preventDefault();
        event.stopPropagation();
        this.closeAllMenus(); // Luôn đóng các menu khác trước khi mở menu mới

        const originalMenuId = `edit-menu-${context}-${exIndex}`;
        const originalMenu = document.getElementById(originalMenuId);
        const button = event.target.closest('.btn-ex-action');

        if (!originalMenu || !button) {
            console.error(`Original menu template not found for context '${context}', index ${exIndex}`);
            return;
        }

        // Tạo một menu tạm thời để hiển thị, tránh di chuyển menu gốc
        const activeMenu = document.createElement('div');
        activeMenu.className = 'exercise-menu active-menu-instance';
        activeMenu.innerHTML = originalMenu.innerHTML;
        
        // Style cho menu
        activeMenu.style.cssText = `
            position: fixed;
            background-color: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-lg);
            box-shadow: var(--shadow-lg);
            padding: var(--spacing-sm) 0;
            min-width: 200px;
            display: flex;
            flex-direction: column;
            z-index: 10001;
        `;

        // Gắn menu tạm thời vào body
        document.body.appendChild(activeMenu);

        // Định vị menu
        const buttonRect = button.getBoundingClientRect();
        const menuWidth = activeMenu.offsetWidth || 220;
        const menuHeight = activeMenu.offsetHeight || 300;
        
        let top = buttonRect.bottom + 5;
        let left = buttonRect.right - menuWidth;

        // Điều chỉnh để menu không bị ra ngoài màn hình
        if (left < 10) left = 10;
        if (left + menuWidth > window.innerWidth) left = window.innerWidth - menuWidth - 10;
        if (top + menuHeight > window.innerHeight) top = buttonRect.top - menuHeight - 5;
        if (top < 10) top = 10;

        activeMenu.style.top = `${top}px`;
        activeMenu.style.left = `${left}px`;
        
        // Tạo một lớp phủ (backdrop) trong suốt để bắt sự kiện click ra ngoài
        const backdrop = document.createElement('div');
        backdrop.className = 'menu-backdrop';
        backdrop.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            z-index: 10000;
            background: transparent;
        `;
        backdrop.onclick = () => this.closeAllMenus();
        document.body.appendChild(backdrop);
        
        // Ngăn việc click vào menu làm menu tự đóng
        activeMenu.onclick = (e) => e.stopPropagation();
    }

    closeAllMenus() {
        // Tìm và xóa tất cả các menu tạm thời và backdrop đang hoạt động
        document.querySelectorAll('.active-menu-instance').forEach(menu => menu.remove());
        document.querySelectorAll('.menu-backdrop').forEach(backdrop => backdrop.remove());
    }

    // ===== PAGE NAVIGATION =====
    loadPage(page) {
        // Update active nav
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.page === page);
        });
        
        // Update active page
        document.querySelectorAll('.page').forEach(pageEl => {
            pageEl.classList.toggle('active', pageEl.id === `${page}-page`);
        });
        
        this.currentPage = page;
        
        // Load page content
        switch(page) {
            case 'home':
                this.loadHomePage();
                break;
            case 'templates':
                this.loadTemplatesPage();
                break;
            case 'exercises':
                this.loadExercisesPage();
                break;
            case 'history':
                this.loadHistoryPage();
                break;
            case 'analytics':
                this.loadAnalyticsPage();
                break;
        }
    }

    // ===== HOME PAGE =====
    loadHomePage() {
        this.renderRecentTemplates();
        this.updateStats();
    }

    renderRecentTemplates() {
        const container = document.getElementById('recent-templates');
        const recentTemplates = this.templates.slice(0, 4);
        const cachedWorkout = this.loadData('currentWorkout');
        
        if (cachedWorkout && !cachedWorkout.endTime) {
            const template = this.templates.find(t => t.id === cachedWorkout.templateId);
            const templateName = template ? template.name : 'Buổi tập chưa đặt tên';
            const oldBanner = document.getElementById('resume-workout-banner');
            if (oldBanner) oldBanner.remove();
            
            container.insertAdjacentHTML('beforebegin', `
                <div id="resume-workout-banner" class="resume-workout-banner" style="margin-bottom:16px;display:flex;gap:12px;align-items:center;background:var(--primary);color:white;padding:12px;border-radius:8px;">
                    <div style="flex:1;">
                        <b>Buổi tập chưa hoàn thành:</b> <span style="font-weight:600;">${templateName}</span>
                    </div>
                    <button class="btn btn-sm" title="Tiếp tục" onclick="app.resumeWorkout()" style="background:rgba(255,255,255,0.2);color:white;border:none;">▶️ Tiếp tục</button>
                    <button class="btn btn-sm" title="Xóa" onclick="app.deleteResumeWorkout()" style="background:rgba(255,255,255,0.2);color:white;border:none;">🗑️</button>
                </div>
            `);
        }
        
        if (recentTemplates.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📋</div>
                    <div class="empty-title">Chưa có template nào</div>
                    <div class="empty-text">Tạo template đầu tiên để bắt đầu</div>
                    <button class="btn btn-primary" onclick="app.createTemplate()">Tạo template</button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = recentTemplates.map(template => 
            this.createTemplateCard(template)
        ).join('');
    }

    updateStats() {
        const totalWorkouts = this.workoutHistory.length;
        const totalTemplates = this.templates.length;
        
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        
        const thisWeekWorkouts = this.workoutHistory.filter(workout => 
            new Date(workout.date) >= weekStart
        ).length;
        
        const totalVolume = this.workoutHistory.reduce((total, workout) => {
            return total + workout.exercises.reduce((sum, ex) => {
                return sum + ex.sets.reduce((setSum, set) => {
                    return setSum + (set.weight * set.reps);
                }, 0);
            }, 0);
        }, 0);
        
        document.getElementById('total-workouts').textContent = totalWorkouts;
        document.getElementById('total-templates').textContent = totalTemplates;
        document.getElementById('this-week').textContent = thisWeekWorkouts;
        document.getElementById('total-volume').textContent = Math.round(totalVolume);
    }

    // ===== TEMPLATES PAGE =====
    loadTemplatesPage() {
        this.renderAllTemplates();
    }

    renderAllTemplates() {
        const container = document.getElementById('all-templates');
        
        if (this.templates.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📋</div>
                    <div class="empty-title">Chưa có template nào</div>
                    <div class="empty-text">Tạo template đầu tiên để bắt đầu</div>
                    <button class="btn btn-primary" onclick="app.createTemplate()">Tạo template</button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.templates.map(template => 
            this.createTemplateCard(template)
        ).join('');
    }

    createTemplateCard(template) {
        const lastWorkout = this.getLastWorkout(template.id);
        const lastPerformed = lastWorkout ? this.getTimeAgo(lastWorkout.date) : 'Chưa tập';
        
        return `
            <div class="template-card" onclick="app.showTemplatePreview('${template.id}')">
                <div class="template-header">
                    <div>
                        <h3 class="template-name">${template.name}</h3>
                        <div class="template-meta">
                            ${template.level ? `<span class="template-badge">${this.getLevelText(template.level)}</span>` : ''}
                            <span class="template-badge">⏱️ ${template.duration || 60} phút</span>
                        </div>
                    </div>
                </div>
                <div class="template-exercises">
                    ${template.exercises.slice(0, 3).map(ex => ex.name).join(', ')}
                    ${template.exercises.length > 3 ? '...' : ''}
                </div>
                <div class="template-footer">
                    <span class="template-stat">🕐 ${lastPerformed}</span>
                    <span class="template-stat">${template.exercises.length} bài tập</span>
                </div>
            </div>
        `;
    }

    showTemplatePreview(templateId) {
        this.closeAllModals();
        const template = this.templates.find(t => t.id === templateId);
        if (!template) return;

        this.currentTemplate = template;

        document.getElementById('template-preview-title').textContent = template.name;

        const list = template.exercises.map(ex => `
            <div class="exercise-select-item">
                <div class="exercise-icon">${this.getMuscleIcon(ex.muscle)}</div>
                <div>
                    <div style="color: var(--text-primary); font-weight: 500;">
                        ${ex.sets?.length || 3} × ${ex.name}
                    </div>
                    <div class="text-muted">${this.getMuscleName(ex.muscle)}</div>
                </div>
            </div>
        `).join('');

        document.getElementById('template-preview-list').innerHTML = list;
        document.getElementById('template-preview-modal').classList.add('active');
    }

    editTemplateFromPreview() {
        if (!this.currentTemplate) return;
        this.closeTemplatePreview();
        this.editTemplate(this.currentTemplate.id);
    }

    startWorkoutFromPreview() {
        this.closeTemplatePreview();
        if (this.currentTemplate)
            this.startWorkout(this.currentTemplate.id);
    }

    closeTemplatePreview() {
        document.getElementById('template-preview-modal').classList.remove('active');
    }

    filterTemplates(search = '', level = '') {
        const searchInput = document.getElementById('template-search');
        const filterSelect = document.getElementById('template-filter');
        
        search = search || searchInput?.value || '';
        level = level || filterSelect?.value || '';
        
        const filtered = this.templates.filter(template => {
            const matchesSearch = !search || 
                template.name.toLowerCase().includes(search.toLowerCase());
            const matchesLevel = !level || template.level === level;
            return matchesSearch && matchesLevel;
        });
        
        const container = document.getElementById('all-templates');
        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-text">Không tìm thấy template nào</div></div>';
        } else {
            container.innerHTML = filtered.map(template => 
                this.createTemplateCard(template)
            ).join('');
        }
    }

    // ===== EXERCISES PAGE - UNIFIED VERSION =====
    loadExercisesPage() {
        this.renderAllExercises();
        this.updateExerciseStats();
    }

    renderAllExercises() {
        const container = document.getElementById('all-exercises');
        
        if (this.exercises.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🏋️</div>
                    <div class="empty-title">Chưa có bài tập nào</div>
                    <div class="empty-text">Thêm bài tập để sử dụng trong templates</div>
                    <button class="btn btn-primary" onclick="app.openAddExerciseModal()">
                        ➕ Thêm bài tập
                    </button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.exercises.map(exercise => 
            this.createExerciseCard(exercise)
        ).join('');
    }

    createExerciseCard(exercise) {
        const muscle = exercise.muscle || exercise.muscleGroup || 'other';
        const muscleName = this.getMuscleName(muscle) || '';
        const type = exercise.type || 'strength';
        const equipment = exercise.equipment || 'N/A';
        const name = exercise.name || '(No name)';
        
        return `
            <div class="exercise-card" data-exercise-id="${exercise.id}">
                <div class="exercise-thumbnail" style="margin-bottom:8px;display:flex;justify-content:center;align-items:center;min-height:64px;">
                    ${
                        exercise.image && exercise.image.trim() !== ""
                        ? `<img src="${exercise.image}" alt="${name}" class="exercise-img-thumb"
                               style="width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid #bbb;"
                               onerror="this.style.display='none'; this.parentElement.innerHTML='<div class=\\'exercise-icon\\'>${this.getMuscleIcon(muscle)}</div>'">`
                        : `<div class="exercise-icon" style="font-size:2.5em;">${this.getMuscleIcon(muscle)}</div>`
                    }
                </div>
                <div class="exercise-name">${name}</div>
                <div class="exercise-muscle">${muscleName}</div>
                <div class="exercise-meta" style="font-size:0.8em;color:var(--text-secondary);margin:4px 0;">
                    <span class="exercise-type">${this.getTypeIcon(type)} ${type}</span>
                    <br>
                    <span class="exercise-equipment">${this.getEquipmentIcon(equipment)} ${equipment}</span>
                </div>
                <div class="exercise-actions" style="margin-top:8px;display:flex;gap:4px;justify-content:center;">
                    <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); app.openEditExerciseModal('${exercise.id}')" title="Chỉnh sửa">✏️</button>
                    <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); app.viewExerciseHistory('${exercise.id}')" title="Xem lịch sử">📊</button>
                    <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); app.deleteExercise('${exercise.id}')" title="Xóa">🗑️</button>
                </div>
            </div>
        `;
    }

    updateExerciseStats() {
        const total = this.exercises.length;
        const strengthCount = this.exercises.filter(e => e.type === 'strength').length;
        const cardioCount = this.exercises.filter(e => e.type === 'cardio').length;
        const bodyweightCount = this.exercises.filter(e => e.type === 'bodyweight').length;

        document.getElementById('total-exercises-count').textContent = total;
        document.getElementById('strength-exercises-count').textContent = strengthCount;
        document.getElementById('cardio-exercises-count').textContent = cardioCount;
        document.getElementById('bodyweight-exercises-count').textContent = bodyweightCount;
    }

    // ===== ADD EXERCISE MODAL =====
    openAddExerciseModal() {
        // Reset form
        document.getElementById('exercise-add-form').reset();
        
        // Reset muscle group selection
        document.querySelectorAll('#exercise-add-muscle-group .chip-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        document.getElementById('exercise-add-muscle').value = '';
        
        // Setup chip selection (only once)
        if (!window._muscleChipSetup) {
            document.querySelectorAll('#exercise-add-muscle-group .chip-btn').forEach(btn => {
                btn.onclick = function() {
                    // Remove previous selection
                    document.querySelectorAll('#exercise-add-muscle-group .chip-btn').forEach(b => {
                        b.classList.remove('selected');
                    });
                    // Add current selection
                    btn.classList.add('selected');
                    document.getElementById('exercise-add-muscle').value = btn.dataset.value;
                };
            });
            window._muscleChipSetup = true;
        }
        
        // Show modal
        document.getElementById('exercise-add-modal').classList.add('active');
    }

    closeAddExerciseModal() {
        document.getElementById('exercise-add-modal').classList.remove('active');
        document.getElementById('exercise-add-form').reset();
        
        // Reset image previews
        this.removeExerciseImage('add');
        this.removeUrlImage('add');
        
        // Reset to upload tab
        this.switchImageTab('add', 'upload');
        
        // Clear chip selections
        document.querySelectorAll('#exercise-add-muscle-group .chip-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        document.getElementById('exercise-add-muscle').value = '';
        
        // Clear temp data
        this.tempImageData = null;
        this.tempImageType = 'upload';
    }

    saveAddExercise() {
        const name = document.getElementById('exercise-add-name').value.trim();
        const muscle = document.getElementById('exercise-add-muscle').value;
        const type = document.getElementById('exercise-add-type').value;
        const equipment = document.getElementById('exercise-add-equipment').value;
        const unit = document.getElementById('exercise-add-unit').value;
        const description = document.getElementById('exercise-add-description').value.trim();
        
        if (!name || !muscle) {
            this.showToast('Vui lòng điền đầy đủ thông tin bắt buộc', 'error');
            return;
        }
        
        const newExercise = {
            id: this.generateId(),
            name,
            muscle,
            muscleGroup: muscle,
            type,
            equipment,
            unit,
            description,
            image: this.tempImageData || null,
            imageType: this.tempImageData ? this.tempImageType : null,
            custom: true,
            createdAt: new Date().toISOString()
        };
        
        this.exercises.push(newExercise);
        this.saveData('exercises', this.exercises);
        
        this.closeAddExerciseModal();
        this.renderAllExercises();
        this.updateExerciseStats();
        this.showToast(`Đã thêm bài tập "${name}" thành công!`, 'success');
        
        // Clear temp data
        this.tempImageData = null;
        this.tempImageType = 'upload';
    }

    // ===== IMAGE HANDLING =====
    switchImageTab(mode, tab) {
        // Update tab buttons
        document.querySelectorAll(`#exercise-${mode}-modal .tab-btn`).forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');
        
        // Show/hide tabs
        const uploadTab = document.getElementById(`exercise-${mode}-upload-tab`);
        const urlTab = document.getElementById(`exercise-${mode}-url-tab`);
        
        if (tab === 'upload') {
            uploadTab.style.display = 'block';
            urlTab.style.display = 'none';
            this.tempImageType = 'upload';
        } else {
            uploadTab.style.display = 'none';
            urlTab.style.display = 'block';
            this.tempImageType = 'url';
        }
    }

    previewExerciseImage(event, mode) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            this.showToast('Ảnh phải nhỏ hơn 5MB', 'error');
            event.target.value = '';
            return;
        }
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
            this.showToast('Vui lòng chọn file ảnh', 'error');
            event.target.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const previewContainer = document.getElementById(`exercise-${mode}-image-preview`);
            previewContainer.classList.add('has-image');
            previewContainer.innerHTML = `
                <div class="preview-image-wrapper">
                    <img src="${e.target.result}" alt="Preview">
                    <button type="button" class="remove-image-btn" onclick="app.removeExerciseImage('${mode}')" title="Xóa ảnh">×</button>
                </div>
            `;
            
            // Store image data
            this.tempImageData = e.target.result;
            this.tempImageType = 'upload';
        };
        reader.readAsDataURL(file);
    }

    async previewImageFromUrl(mode) {
        const urlInput = document.getElementById(`exercise-${mode}-image-url`);
        const url = urlInput.value.trim();
        
        if (!url) {
            this.showToast('Vui lòng nhập URL hình ảnh', 'warning');
            return;
        }
        
        // Validate URL format
        if (!this.isValidImageUrl(url)) {
            this.showToast('URL không hợp lệ. Vui lòng nhập URL hình ảnh (.jpg, .png, .gif, .webp)', 'error');
            return;
        }
        
        const previewContainer = document.getElementById(`exercise-${mode}-url-preview`);
        previewContainer.style.display = 'block';
        previewContainer.innerHTML = `
            <div class="image-loading">
                <div class="loading-spinner"></div>
                <span>Đang tải ảnh...</span>
            </div>
        `;
        
        try {
            // Test if image loads successfully
            await this.testImageUrl(url);
            
            previewContainer.classList.add('has-image');
            previewContainer.innerHTML = `
                <div class="preview-image-wrapper">
                    <img src="${url}" alt="Preview" onload="app.onImageLoaded('${mode}')" onerror="app.onImageError('${mode}')">
                    <button type="button" class="remove-image-btn" onclick="app.removeUrlImage('${mode}')" title="Xóa ảnh">×</button>
                </div>
            `;
            
            // Store image URL
            this.tempImageData = url;
            this.tempImageType = 'url';
            
        } catch (error) {
            previewContainer.innerHTML = `
                <div class="image-error">
                    <span class="error-icon">⚠️</span>
                    <span>Không thể tải ảnh từ URL này</span>
                    <small>${error.message}</small>
                </div>
            `;
        }
    }

    isValidImageUrl(url) {
        try {
            const urlObj = new URL(url);
            const validProtocols = ['http:', 'https:'];
            const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
            
            if (!validProtocols.includes(urlObj.protocol)) {
                return false;
            }
            
            // Check if URL has image extension or common image hosting patterns
            const pathname = urlObj.pathname.toLowerCase();
            const hasImageExtension = validExtensions.some(ext => pathname.endsWith(ext));
            const isImageHost = urlObj.hostname.includes('imgur') || 
                               urlObj.hostname.includes('cloudinary') ||
                               urlObj.hostname.includes('unsplash') ||
                               urlObj.hostname.includes('pexels');
            
            return hasImageExtension || isImageHost || pathname.includes('/image');
        } catch {
            return false;
        }
    }

    testImageUrl(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => reject(new Error('Không thể tải ảnh'));
            img.src = url;
            
            // Timeout after 10 seconds
            setTimeout(() => reject(new Error('Timeout - Ảnh tải quá lâu')), 10000);
        });
    }

    onImageLoaded(mode) {
        console.log('Image loaded successfully');
    }

    onImageError(mode) {
        const previewContainer = document.getElementById(`exercise-${mode}-url-preview`);
        previewContainer.innerHTML = `
            <div class="image-error">
                <span class="error-icon">⚠️</span>
                <span>Lỗi tải ảnh</span>
                <small>Kiểm tra lại URL hoặc thử URL khác</small>
            </div>
        `;
        this.tempImageData = null;
    }

    handleImageUrlPaste(event, mode) {
        setTimeout(() => {
            const url = event.target.value.trim();
            if (this.isValidImageUrl(url)) {
                this.previewImageFromUrl(mode);
            }
        }, 100);
    }

    debounceImageUrlPreview(mode) {
        clearTimeout(this.imagePreviewTimeout);
        this.imagePreviewTimeout = setTimeout(() => {
            const url = document.getElementById(`exercise-${mode}-image-url`).value.trim();
            if (url && this.isValidImageUrl(url)) {
                this.previewImageFromUrl(mode);
            }
        }, 1000);
    }

    removeExerciseImage(mode) {
        const input = document.getElementById(`exercise-${mode}-image`);
        const previewContainer = document.getElementById(`exercise-${mode}-image-preview`);
        
        input.value = '';
        this.tempImageData = null;
        
        previewContainer.classList.remove('has-image');
        previewContainer.innerHTML = `
            <label for="exercise-${mode}-image" class="upload-placeholder">
                <span class="upload-icon">📷</span>
                <span class="upload-text">Click để ${mode === 'add' ? 'tải ảnh lên' : 'thay đổi ảnh'}</span>
            </label>
        `;
    }

    removeUrlImage(mode) {
        const urlInput = document.getElementById(`exercise-${mode}-image-url`);
        const previewContainer = document.getElementById(`exercise-${mode}-url-preview`);
        
        urlInput.value = '';
        this.tempImageData = null;
        
        previewContainer.style.display = 'none';
        previewContainer.innerHTML = '';
    }

    // ===== EDIT EXERCISE MODAL =====
    openEditExerciseModal(exerciseId) {
        const exercise = this.exercises.find(ex => ex.id === exerciseId);
        if (!exercise) return;
        
        this.editingExerciseId = exerciseId;
        
        // Reset form
        document.getElementById('exercise-edit-name').value = exercise.name;
        document.getElementById('exercise-edit-muscle').value = exercise.muscle || exercise.muscleGroup;
        document.getElementById('exercise-edit-type').value = exercise.type || 'strength';
        document.getElementById('exercise-edit-equipment').value = exercise.equipment || 'barbell';
        document.getElementById('exercise-edit-unit').value = exercise.unit || 'kg';
        document.getElementById('exercise-edit-description').value = exercise.description || '';
        
        // Reset tabs
        this.switchImageTab('edit', exercise.imageType || 'upload');
        
        // Load existing image
        if (exercise.image) {
            if (exercise.imageType === 'url') {
                document.getElementById('exercise-edit-image-url').value = exercise.image;
                this.previewImageFromUrl('edit');
            } else {
                const previewContainer = document.getElementById('exercise-edit-image-preview');
                previewContainer.classList.add('has-image');
                previewContainer.innerHTML = `
                    <div class="preview-image-wrapper">
                        <img src="${exercise.image}" alt="${exercise.name}">
                        <button type="button" class="remove-image-btn" onclick="app.removeExerciseImage('edit')" title="Xóa ảnh">×</button>
                    </div>
                `;
            }
        }
        
        document.getElementById('exercise-edit-modal').classList.add('active');
    }

    closeEditExerciseModal() {
        document.getElementById('exercise-edit-modal').classList.remove('active');
        this.editingExerciseId = null;
        
        // Clear temp data
        this.tempImageData = undefined;
        this.tempImageType = 'upload';
    }

    saveEditExercise() {
        if (!this.editingExerciseId) return;
        
        const exercise = this.exercises.find(ex => ex.id === this.editingExerciseId);
        if (!exercise) return;
        
        const name = document.getElementById('exercise-edit-name').value.trim();
        const muscle = document.getElementById('exercise-edit-muscle').value;
        const type = document.getElementById('exercise-edit-type').value;
        const equipment = document.getElementById('exercise-edit-equipment').value;
        const unit = document.getElementById('exercise-edit-unit').value;
        const description = document.getElementById('exercise-edit-description').value.trim();
        
        if (!name) {
            this.showToast('Tên bài tập không được để trống', 'error');
            return;
        }
        
        // Update exercise data
        exercise.name = name;
        exercise.muscle = muscle;
        exercise.muscleGroup = muscle;
        exercise.type = type;
        exercise.equipment = equipment;
        exercise.unit = unit;
        exercise.description = description;
        
        // Update image if changed
        if (this.tempImageData !== undefined) {
            exercise.image = this.tempImageData;
            exercise.imageType = this.tempImageData ? this.tempImageType : null;
        }
        
        exercise.updatedAt = new Date().toISOString();
        
        this.saveData('exercises', this.exercises);
        this.closeEditExerciseModal();
        this.renderAllExercises();
        this.updateExerciseStats();
        this.showToast('Đã cập nhật bài tập thành công!', 'success');
        
        // Clear temp data
        this.tempImageData = undefined;
        this.tempImageType = 'upload';
    }

    // ===== DELETE EXERCISE =====
    deleteExercise(exerciseId) {
        if (!confirm("Bạn chắc chắn muốn xóa bài tập này?")) return;
        
        const exerciseIndex = this.exercises.findIndex(e => e.id === exerciseId);
        if (exerciseIndex === -1) {
            this.showToast("Không tìm thấy bài tập!", "error");
            return;
        }
        
        // Check if exercise is used in templates
        const isUsedInTemplates = this.templates.some(template => 
            template.exercises.some(ex => ex.id === exerciseId)
        );
        
        if (isUsedInTemplates) {
            if (!confirm("Bài tập này đang được sử dụng trong templates. Vẫn muốn xóa?")) {
                return;
            }
        }
        
        this.exercises.splice(exerciseIndex, 1);
        this.saveData('exercises', this.exercises);
        this.renderAllExercises();
        this.updateExerciseStats();
        this.showToast("Đã xóa bài tập.", "success");
    }

    // ===== EXERCISE HISTORY VIEW =====
    viewExerciseHistory(exerciseId) {
        const exercise = this.exercises.find(e => e.id === exerciseId);
        if (!exercise) return;
        
        // Find workout history for this exercise
        const exerciseHistory = [];
        this.workoutHistory.forEach(workout => {
            const workoutExercise = workout.exercises.find(e => e.id === exerciseId);
            if (workoutExercise) {
                exerciseHistory.push({
                    date: workout.date,
                    sets: workoutExercise.sets,
                    maxWeight: Math.max(...workoutExercise.sets.map(s => s.weight || 0)),
                    totalVolume: workoutExercise.sets.reduce((sum, set) => sum + (set.weight * set.reps || 0), 0)
                });
            }
        });
        
        // Sort by date (newest first)
        exerciseHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Create history HTML
        let historyHtml = `<h4>${exercise.name} - Lịch sử tập luyện</h4>`;
        
        if (exerciseHistory.length === 0) {
            historyHtml += '<p>Chưa có lịch sử cho bài tập này.</p>';
        } else {
            // Calculate personal records
            const maxWeight = Math.max(...exerciseHistory.map(h => h.maxWeight));
            const maxVolume = Math.max(...exerciseHistory.map(h => h.totalVolume));
            
            historyHtml += `
                <div style="background:var(--bg-secondary);padding:12px;border-radius:8px;margin-bottom:16px;">
                    <h5>🏆 Personal Records</h5>
                    <div style="display:flex;gap:20px;">
                        <div><strong>Max Weight:</strong> ${maxWeight}${exercise.unit || 'kg'}</div>
                        <div><strong>Max Volume:</strong> ${Math.round(maxVolume)}${exercise.unit || 'kg'}</div>
                    </div>
                </div>
            `;
            
            historyHtml += '<div class="exercise-history-list">';
            exerciseHistory.slice(0, 10).forEach(entry => {
                historyHtml += `
                    <div class="history-entry" style="margin-bottom:12px;padding:8px;background:var(--bg-secondary);border-radius:8px;">
                        <div style="font-weight:600;">${this.formatDate(entry.date)}</div>
                        <div style="color:var(--text-secondary);font-size:0.9em;">
                            Max: ${entry.maxWeight}${exercise.unit || 'kg'} | Volume: ${Math.round(entry.totalVolume)}${exercise.unit || 'kg'}
                        </div>
                        <div style="font-size:0.85em;margin-top:4px;">
                            ${entry.sets.map((set, idx) => 
                                `Set ${idx + 1}: ${set.weight}${exercise.unit || 'kg'} × ${set.reps}`
                            ).join(' | ')}
                        </div>
                    </div>
                `;
            });
            historyHtml += '</div>';
        }
        
        document.getElementById('exercise-history-title').textContent = `${exercise.name} - Lịch sử`;
        document.getElementById('exercise-history-list').innerHTML = historyHtml;
        document.getElementById('exercise-history-modal').classList.add('active');
    }

    closeExerciseHistory() {
        document.getElementById('exercise-history-modal').classList.remove('active');
    }

    // ===== EXERCISE FILTERING =====
    filterExercises(search = '', muscle = '') {
        const searchInput = document.getElementById('exercise-search');
        const muscleFilter = document.getElementById('muscle-filter');
        const equipmentFilter = document.getElementById('equipment-filter');
        
        search = search || searchInput?.value || '';
        muscle = muscle || muscleFilter?.value || '';
        const equipment = equipmentFilter?.value || '';
        
        const filtered = this.exercises.filter(exercise => {
            const exerciseMuscle = exercise.muscle || exercise.muscleGroup || '';
            const matchesSearch = !search || 
                exercise.name.toLowerCase().includes(search.toLowerCase()) ||
                exercise.equipment.toLowerCase().includes(search.toLowerCase()) ||
                exercise.type.toLowerCase().includes(search.toLowerCase());
            const matchesMuscle = !muscle || exerciseMuscle === muscle;
            const matchesEquipment = !equipment || exercise.equipment === equipment;
            return matchesSearch && matchesMuscle && matchesEquipment;
        });
        
        const container = document.getElementById('all-exercises');
        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-text">Không tìm thấy bài tập nào</div>
                    <button class="btn btn-primary" onclick="app.openAddExerciseModal()">
                        ➕ Thêm bài tập mới
                    </button>
                </div>
            `;
        } else {
            container.innerHTML = filtered.map(exercise => 
                this.createExerciseCard(exercise)
            ).join('');
        }
    }

    // ===== EXPORT/IMPORT EXERCISES =====
    exportExercises() {
        const data = {
            exercises: this.exercises,
            exportDate: new Date().toISOString(),
            version: "1.0",
            app: "Gym Tracker"
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gym-tracker-exercises-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showToast('Đã xuất danh sách bài tập! 📤', 'success');
    }

    importExercises(event) {
        const file = event.target.files[0];
        if (!file) {
            this.showToast('Không có file nào được chọn.', 'warning');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                // Validate data structure
                if (!data.exercises || !Array.isArray(data.exercises)) {
                    this.showToast('File không hợp lệ (thiếu exercises array)', 'error');
                    return;
                }
                
                // Confirm import action
                const action = confirm(
                    `Import sẽ thay thế ${this.exercises.length} bài tập hiện tại bằng ${data.exercises.length} bài tập mới. Tiếp tục?`
                );
                
                if (!action) return;
                
                // Import exercises
                this.exercises = data.exercises.map(ex => ({
                    ...ex,
                    id: ex.id || this.generateId(), // Ensure each exercise has ID
                    importedAt: new Date().toISOString()
                }));
                
                this.saveData('exercises', this.exercises);
                this.renderAllExercises();
                this.updateExerciseStats();
                this.showToast(`Đã import ${data.exercises.length} bài tập thành công! ✅`, 'success');
                
            } catch (err) {
                console.error('Import error:', err);
                this.showToast('File không hợp lệ hoặc bị lỗi!', 'error');
            }
        };
        reader.readAsText(file);
        
        // Reset file input
        event.target.value = '';
    }

    // ===== UTILITY METHODS FOR EXERCISES =====
    getMuscleIcon(muscle) {
        const icons = {
            chest: '💪',
            back: '🔙', 
            legs: '🦵',
            shoulders: '💪',
            arms: '💪',
            core: '🔥',
            cardio: '❤️',
            fullbody: '🏃',
            olympic: '🏋️',
            other: '💪'
        };
        return icons[muscle] || '💪';
    }

    getMuscleName(muscle) {
        const names = {
            chest: 'Ngực',
            back: 'Lưng', 
            legs: 'Chân',
            shoulders: 'Vai',
            arms: 'Tay',
            core: 'Bụng',
            cardio: 'Cardio',
            fullbody: 'Toàn thân',
            olympic: 'Olympic',
            other: 'Khác'
        };
        return names[muscle] || muscle;
    }

    getTypeIcon(type) {
        const icons = {
            strength: '💪',
            bodyweight: '🤸',
            cardio: '❤️',
            hiit: '🔥',
            mobility: '🧘',
            stretching: '🤸',
            plyometrics: '⚡'
        };
        return icons[type] || '💪';
    }

    getEquipmentIcon(equipment) {
        const icons = {
            bodyweight: '🤸',
            barbell: '🏋️',
            dumbbell: '🏋️',
            machine: '🔧',
            cable: '🔗',
            weightedbodyweight: '⚖️',
            assistedbodyweight: '🤝',
            reponly: '🔢',
            cardio: '❤️',
            duration: '⏱️'
        };
        return icons[equipment] || '🔧';
    }

    // ===== HISTORY PAGE =====
    loadHistoryPage() {
        this.renderHistory();
    }

    renderHistory() {
        const container = document.getElementById('workout-history');
        
        if (this.workoutHistory.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📊</div>
                    <div class="empty-title">Chưa có lịch sử tập luyện</div>
                    <div class="empty-text">Bắt đầu tập để theo dõi tiến trình</div>
                </div>
            `;
            return;
        }
        
        const sortedHistory = [...this.workoutHistory].sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );
        
        container.innerHTML = sortedHistory.map(workout => 
            this.createHistoryItem(workout)
        ).join('');
    }

    createHistoryItem(workout) {
        const template = this.templates.find(t => t.id === workout.templateId);
        const totalVolume = workout.exercises.reduce((sum, ex) => {
            return sum + ex.sets.reduce((setSum, set) => {
                return setSum + (set.weight * set.reps);
            }, 0);
        }, 0);
        
        return `
            <div class="history-item" onclick="app.viewWorkoutDetails('${workout.id}')">
                <div class="history-header">
                    <div>
                        <div class="history-date">${this.formatDate(workout.date)}</div>
                        <div class="history-template">${template?.name || 'Workout'}</div>
                    </div>
                </div>
                <div class="history-stats">
                    <span>⏱️ ${workout.duration} phút</span>
                    <span>🏋️ ${workout.exercises.length} bài tập</span>
                    <span>💪 ${Math.round(totalVolume)} kg</span>
                </div>
            </div>
        `;
    }

    viewWorkoutDetails(workoutId) {
        const workout = this.workoutHistory.find(w => w.id === workoutId);
        const template = this.templates.find(t => t.id === workout.templateId);
        let html = `<h4>${template ? template.name : 'Workout'}</h4>`;
        html += `<div>Ngày tập: ${this.formatDate(workout.date)} | Thời lượng: ${workout.duration} phút</div>`;
        html += '<ul style="margin:12px 0;">';
        workout.exercises.forEach(ex => {
            html += `<li style="margin-bottom:8px;"><b>${ex.name}</b>: `;
            ex.sets.forEach((set, idx) => {
                html += `Set ${idx + 1}: ${set.weight} ${ex.unit || 'kg'} x ${set.reps} rep${set.reps > 1 ? 's' : ''} | `;
            });
            html += '</li>';
        });
        html += '</ul>';
        document.getElementById('workout-detail-content').innerHTML = html;
        document.getElementById('workout-detail-modal').classList.add('active');
    }

    // ===== WORKOUT FUNCTIONS =====
    startQuickWorkout() {
        const cachedWorkout = this.loadData('currentWorkout');
        if (cachedWorkout && !cachedWorkout.endTime) {
            if (confirm("Bạn đang có buổi tập chưa hoàn thành. Tiếp tục không?")) {
                this.currentWorkout = cachedWorkout;
                this.showWorkoutModal(this.templates.find(t => t.id === cachedWorkout.templateId));
                this.startWorkoutTimer();
                return;
            } else {
                this.saveData('currentWorkout', null);
                this.currentWorkout = null;
            }
        }
        
        if (this.templates.length === 0) {
            this.showToast('Bạn cần tạo template trước!', 'warning');
            this.createTemplate();
            return;
        }
        
        const recentTemplate = this.templates[0];
        this.startWorkout(recentTemplate.id);
    }

    resumeWorkout() {
        const cachedWorkout = this.loadData('currentWorkout');
        if (!cachedWorkout) return;
        this.currentWorkout = cachedWorkout;
        const template = this.templates.find(t => t.id === cachedWorkout.templateId);
        this.showWorkoutModal(template);
        this.startWorkoutTimer();
    }

    deleteResumeWorkout() {
        if (confirm("Bạn chắc chắn muốn xoá buổi tập chưa hoàn thành này?")) {
            this.saveData('currentWorkout', null);
            this.currentWorkout = null;
            const banner = document.getElementById('resume-workout-banner');
            if (banner) banner.remove();
            this.showToast('Đã xoá buổi tập chưa hoàn thành.', 'success');
        }
    }

    startWorkout(templateId) {
        const cachedWorkout = this.loadData('currentWorkout');
        if (cachedWorkout && !cachedWorkout.endTime && cachedWorkout.templateId === templateId) {
            if (confirm("Bạn đang có buổi tập chưa hoàn thành. Tiếp tục không?")) {
                this.currentWorkout = cachedWorkout;
                this.showWorkoutModal(this.templates.find(t => t.id === cachedWorkout.templateId));
                this.startWorkoutTimer();
                return;
            } else {
                this.saveData('currentWorkout', null);
                this.currentWorkout = null;
            }
        }

        const template = this.templates.find(t => t.id === templateId);
        if (!template) return;

        this.currentWorkout = {
            id: this.generateId(),
            templateId: template.id,
            date: new Date().toISOString(),
            startTime: Date.now(),
            exercises: template.exercises.map(ex => ({
                ...ex,
                sets: ex.sets.map(set => ({
                    ...set,
                    weight: 0,
                    reps: 0,
                    completed: false
                })),
                restAfterLastSet: "1:00"
            }))
        };

        this.saveData('currentWorkout', this.currentWorkout);
        this.showWorkoutModal(template);
        this.startWorkoutTimer();
    }

    showWorkoutModal(template) {
        this.closeAllModals();
        document.getElementById('workout-title').textContent = template.name;
        this.renderWorkoutExercises();
        document.getElementById('workout-modal').classList.add('active');
    }

    renderWorkoutExercises() {
        const container = document.getElementById('workout-exercises');
        container.innerHTML = '';

        this.currentWorkout.exercises.forEach((exercise, exIndex) => {
            const unitLabel = exercise.unit === 'lb' ? 'lb'
                            : exercise.unit === 'minute' ? 'Min'
                            : exercise.unit === 'second' ? 'Sec'
                            : 'kg';
            const repsLabel = exercise.unit === 'minute' ? 'Minute'
                            : exercise.unit === 'second' ? 'Second'
                            : 'Reps';

            let noteHtml = '';
            if (exercise.note) noteHtml += `<div class="exercise-note" style="color:var(--primary);font-size:0.93em;margin:8px 0;">📝 ${exercise.note}</div>`;
            if (exercise.stickyNote) noteHtml += `<div class="exercise-sticky-note" style="color:#FFEB3B;font-weight:bold;">📌 ${exercise.stickyNote}</div>`;

            let setsHtml = `
                <div class="set-row set-row-header">
                    <div class="set-number">Set</div>
                    <div class="set-previous">Previous</div>
                    <div class="set-weight">${unitLabel}</div>
                    <div class="set-reps">${repsLabel}</div>
                    <div class="set-complete">✓</div>
                </div>
            `;

            exercise.sets.forEach((set, setIndex) => {
                const warmupIcon = set.isWarmup ? '<span title="Warm-up set" style="color:#29b6f6;font-size:1.1em;">🔥</span>' : '';
                setsHtml += `
                    <div class="set-block${set.completed ? ' set-completed' : ''}">
                        <div class="set-row">
                            <div class="set-number">${setIndex + 1} ${warmupIcon}</div>
                            <div class="set-previous">${set.previous || ''}</div>
                            <div class="set-weight">
                                <input type="number" value="${set.weight || ''}"
                                    placeholder="${unitLabel}"
                                    onchange="app.updateSet(${exIndex},${setIndex},'weight',this.value)">
                            </div>
                            <div class="set-reps">
                                <input type="number" value="${set.reps || ''}"
                                    placeholder="${repsLabel}"
                                    onchange="app.updateSet(${exIndex},${setIndex},'reps',this.value)">
                            </div>
                            <div class="set-complete">
                                <input type="checkbox" class="complete-checkbox"
                                    ${set.completed ? 'checked' : ''}
                                    onchange="app.toggleSetComplete(${exIndex},${setIndex})">
                            </div>
                        </div>
                        ${
                            setIndex < exercise.sets.length - 1
                            ? `
                                <div class="rest-bar-wrap">
                                    <div class="rest-bar"
                                        onclick="app.editSetRestTime(${exIndex},${setIndex + 1})"
                                        id="rest-bar-${exIndex}-${setIndex + 1}">
                                        <span class="rest-bar-timer"
                                            id="rest-timer-${exIndex}-${setIndex + 1}">
                                            ${exercise.sets[setIndex + 1]?.restTime || '1:00'}
                                        </span>
                                        <div class="rest-progress-bar" id="rest-progress-${exIndex}-${setIndex + 1}"></div>
                                    </div>
                                </div>
                            `
                            : ''
                        }
                    </div>
                `;
            });

            setsHtml += `
                <div class="rest-bar-wrap">
                    <div class="rest-bar"
                        onclick="app.editRestAfterLastSet(${exIndex})"
                        id="rest-bar-last-${exIndex}">
                        <span class="rest-bar-timer"
                            id="rest-timer-last-${exIndex}">
                            ${exercise.restAfterLastSet || "1:00"}
                        </span>
                        <div class="rest-progress-bar" id="rest-progress-last-${exIndex}"></div>
                    </div>
                </div>
                <div class="add-set-row" style="text-align:right; margin-top:6px;">
                    <button class="btn btn-primary btn-sm" onclick="app.addSet(${exIndex})">+ Add Set</button>
                </div>
            `;

            container.innerHTML += `
                <div class="workout-exercise" style="background:var(--bg-tertiary);border-radius:12px;padding:16px;margin-bottom:20px;">
                    <div class="workout-exercise-header">
                        <span class="workout-exercise-name">${exercise.name}</span>
                        <div class="exercise-actions">
							<button class="btn-ex-action" onclick="app.toggleExerciseMenu(event, 'workout', ${exIndex})" title="Menu">
								<span class="menu-icon">⋯</span>
							</button>
							<div class="exercise-menu" id="edit-menu-workout-${exIndex}">
                                <button onclick="app.addExerciseNote(${exIndex})">📝 Add Note</button>
                                <button onclick="app.addExerciseSticky(${exIndex})">📌 Add Sticky Note</button>
                                <button onclick="app.addWarmupSet(${exIndex})">➕ Add Warm-up Sets</button>
                                <button onclick="app.updateRestTimers(${exIndex})">⏱ Update Rest Timers</button>
                                <button onclick="app.replaceExercise(${exIndex})">🔄 Replace Exercise</button>
                                <button onclick="app.createSuperset(${exIndex})">⎯⎯ Create Superset</button>
                                <button onclick="app.exercisePreferences(${exIndex}, event)">⚙️ Preferences</button>
                                <button class="danger" onclick="app.removeExercise(${exIndex})">❌ Remove</button>
                            </div>
                        </div>
                    </div>
                    ${noteHtml}
                    <div class="sets-table">
                        ${setsHtml}
                    </div>
                </div>
            `;
        });
    }

    // ===== WORKOUT CONTROLS =====
    updateSet(exIndex, setIndex, field, value) {
        this.currentWorkout.exercises[exIndex].sets[setIndex][field] = parseFloat(value) || 0;
        this.saveData('currentWorkout', this.currentWorkout);
    }

    toggleSetComplete(exIndex, setIndex) {
        const sets = this.currentWorkout.exercises[exIndex].sets;
        const set = sets[setIndex];
        set.completed = !set.completed;

        this.renderWorkoutExercises();

        setTimeout(() => {
            if (set.completed) {
                if (setIndex === sets.length - 1) {
                    this.runRestAfterLastSetTimer(exIndex);
                    const restBar = document.getElementById(`rest-bar-last-${exIndex}`);
                    if (restBar) restBar.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else {
                    if (!this.setRestIntervals) this.setRestIntervals = {};
                    Object.values(this.setRestIntervals).forEach(clearInterval);
                    this.setRestIntervals = {};
                    this.runSetRestTimer(exIndex, setIndex + 1);

                    const restBar = document.getElementById(`rest-bar-${exIndex}-${setIndex + 1}`);
                    if (restBar) restBar.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        }, 0);

        this.saveData('currentWorkout', this.currentWorkout);
    }

    addSet(exIndex) {
        this.currentWorkout.exercises[exIndex].sets.push({
            weight: 0,
            reps: 0,
            restTime: "1:00",
            completed: false,
        });
        this.renderWorkoutExercises();
        this.saveData('currentWorkout', this.currentWorkout);
    }

    // Rest timer functions
    editSetRestTime(exIndex, setIndex) {
        const timerSpan = document.getElementById(`rest-timer-${exIndex}-${setIndex}`);
        let current = timerSpan.textContent.trim();
        timerSpan.outerHTML = `<input type="text" id="rest-timer-input-${exIndex}-${setIndex}" class="set-rest-time" value="${current}" style="width:56px;text-align:center;color:#00bfff;">`;
        const input = document.getElementById(`rest-timer-input-${exIndex}-${setIndex}`);
        input.focus();
        input.addEventListener('blur', () => {
            let val = input.value;
            if (/^\d{1,2}:\d{2}$/.test(val)) {
                this.currentWorkout.exercises[exIndex].sets[setIndex].restTime = val;
            }
            this.renderWorkoutExercises();
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') input.blur();
        });
    }

    runSetRestTimer(exIndex, setIndex) {
        const set = this.currentWorkout.exercises[exIndex]?.sets[setIndex];
        if (!set) return;
        let restTime = set.restTime || "1:00";
        let [min, sec] = restTime.split(":").map(Number);
        let totalTime = min * 60 + sec;
        let timeLeft = totalTime;

        const timerSpan = document.getElementById(`rest-timer-${exIndex}-${setIndex}`);
        const progressBar = document.getElementById(`rest-progress-${exIndex}-${setIndex}`);
        if (!timerSpan || !progressBar) return;

        timerSpan.textContent = this.formatTime(timeLeft);

        progressBar.style.transition = 'none';
        progressBar.style.width = '100%';

        if (!this.setRestIntervals) this.setRestIntervals = {};
        Object.values(this.setRestIntervals).forEach(clearInterval);
        if (this.setRestIntervals[`${exIndex}-${setIndex}`]) {
            clearInterval(this.setRestIntervals[`${exIndex}-${setIndex}`]);
        }

        setTimeout(() => {
            progressBar.style.transition = `width ${totalTime}s linear`;
            progressBar.style.width = '0%';
        }, 50);

        this.setRestIntervals[`${exIndex}-${setIndex}`] = setInterval(() => {
            timeLeft--;
            timerSpan.textContent = this.formatTime(timeLeft);
            if (timeLeft > 0 && timeLeft <= 3) playBeep();
            if (timeLeft <= 0) {
                clearInterval(this.setRestIntervals[`${exIndex}-${setIndex}`]);
                timerSpan.textContent = "Done";
                progressBar.style.width = '0%';
                playDone();
                
                // Check notification settings
                const notificationsEnabled = localStorage.getItem('gymTracker_notifications') !== '0';
                if (notificationsEnabled && this.notifications) {
                    this.notifications.notifyRestComplete();
                }
            }
        }, 1000);
    }

    editRestAfterLastSet(exIndex) {
        const timerSpan = document.getElementById(`rest-timer-last-${exIndex}`);
        let current = timerSpan.textContent.trim();
        timerSpan.outerHTML = `<input type="text" id="rest-timer-last-input-${exIndex}" class="set-rest-time" value="${current}" style="width:56px;text-align:center;color:#00bfff;">`;
        const input = document.getElementById(`rest-timer-last-input-${exIndex}`);
        input.focus();
        input.addEventListener('blur', () => {
            let val = input.value;
            if (/^\d{1,2}:\d{2}$/.test(val)) {
                this.currentWorkout.exercises[exIndex].restAfterLastSet = val;
            }
            this.renderWorkoutExercises();
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') input.blur();
        });
    }

    runRestAfterLastSetTimer(exIndex) {
        let restTime = this.currentWorkout.exercises[exIndex].restAfterLastSet || "1:00";
        let [min, sec] = restTime.split(":").map(Number);
        let totalTime = min * 60 + sec;
        let timeLeft = totalTime;

        const timerSpan = document.getElementById(`rest-timer-last-${exIndex}`);
        const progressBar = document.getElementById(`rest-progress-last-${exIndex}`);
        if (!timerSpan || !progressBar) return;

        timerSpan.textContent = this.formatTime(timeLeft);

        progressBar.style.transition = 'none';
        progressBar.style.width = '100%';

        if (!this.setRestIntervals) this.setRestIntervals = {};
        if (this.setRestIntervals[`last-${exIndex}`]) {
            clearInterval(this.setRestIntervals[`last-${exIndex}`]);
        }

        setTimeout(() => {
            progressBar.style.transition = `width ${totalTime}s linear`;
            progressBar.style.width = '0%';
        }, 50);

        this.setRestIntervals[`last-${exIndex}`] = setInterval(() => {
            timeLeft--;
            timerSpan.textContent = this.formatTime(timeLeft);
            if (timeLeft > 0 && timeLeft <= 3) playBeep();
            if (timeLeft <= 0) {
                clearInterval(this.setRestIntervals[`last-${exIndex}`]);
                timerSpan.textContent = "Done";
                progressBar.style.width = '0%';
                playDone();
                
                const notificationsEnabled = localStorage.getItem('gymTracker_notifications') !== '0';
                if (notificationsEnabled && this.notifications) {
                    this.notifications.notifyRestComplete();
                }
            }
        }, 1000);
    }

    formatTime(seconds) {
        const m = Math.floor(seconds / 60).toString();
        const s = (seconds % 60).toString().padStart(2, "0");
        return `${m}:${s}`;
    }

    // Exercise modification functions
    moveExerciseUp(exIndex) {
        if (exIndex > 0) {
            const temp = this.selectedExercises[exIndex];
            this.selectedExercises[exIndex] = this.selectedExercises[exIndex - 1];
            this.selectedExercises[exIndex - 1] = temp;
            this.renderSelectedExercises();
            this.showToast('Đã di chuyển bài tập lên trên', 'success');
        }
    }

    moveExerciseDown(exIndex) {
        if (exIndex < this.selectedExercises.length - 1) {
            const temp = this.selectedExercises[exIndex];
            this.selectedExercises[exIndex] = this.selectedExercises[exIndex + 1];
            this.selectedExercises[exIndex + 1] = temp;
            this.renderSelectedExercises();
            this.showToast('Đã di chuyển bài tập xuống dưới', 'success');
        }
    }

    duplicateExercise(exIndex) {
        const exercise = { ...this.selectedExercises[exIndex] };
        exercise.sets = exercise.sets.map(set => ({ ...set })); // Deep copy sets
        this.selectedExercises.splice(exIndex + 1, 0, exercise);
        this.renderSelectedExercises();
        this.showToast('Đã nhân đôi bài tập', 'success');
    }

    addExerciseNote(exIndex) {
        const ex = this.currentWorkout.exercises[exIndex];
        const note = prompt("Ghi chú cho bài này:", ex.note || "");
        if (note !== null) {
            ex.note = note.trim();
            this.renderWorkoutExercises();
            this.saveData('currentWorkout', this.currentWorkout);
            this.showToast("Đã lưu ghi chú.");
        }
    }

    addExerciseSticky(exIndex) {
        const ex = this.currentWorkout.exercises[exIndex];
        const sticky = prompt("Sticky note (ghi chú nổi bật):", ex.stickyNote || "");
        if (sticky !== null) {
            ex.stickyNote = sticky.trim();
            this.renderWorkoutExercises();
            this.saveData('currentWorkout', this.currentWorkout);
            this.showToast("Đã lưu sticky note.");
        }
    }

    addWarmupSet(exIndex) {
        const ex = this.currentWorkout.exercises[exIndex];
        const reps = prompt("Số reps cho warm-up set (vd: 10):", "10");
        const weight = prompt("Trọng lượng cho warm-up set (vd: 20):", "20");
        if (reps && weight) {
            ex.sets.unshift({
                weight: parseFloat(weight),
                reps: parseInt(reps),
                restTime: "1:00",
                completed: false,
                isWarmup: true
            });
            this.renderWorkoutExercises();
            this.saveData('currentWorkout', this.currentWorkout);
            this.showToast("Đã thêm warm-up set.");
        }
    }

    updateRestTimers(exIndex) {
        const ex = this.currentWorkout.exercises[exIndex];
        const rest = prompt("Nhập thời gian nghỉ mới (định dạng mm:ss, vd: 1:30):", "1:00");
        if (rest && /^\d{1,2}:\d{2}$/.test(rest)) {
            ex.sets.forEach(set => set.restTime = rest);
            ex.restAfterLastSet = rest;
            this.renderWorkoutExercises();
            this.saveData('currentWorkout', this.currentWorkout);
            this.showToast("Đã cập nhật thời gian nghỉ.");
        } else {
            this.showToast("Định dạng thời gian không hợp lệ.", "warning");
        }
    }

    replaceExercise(exIndex) {
        this.showExercisePicker((newExercise) => {
            this.currentWorkout.exercises[exIndex].name = newExercise.name;
            this.currentWorkout.exercises[exIndex].muscle = newExercise.muscle;
            this.renderWorkoutExercises();
            this.saveData('currentWorkout', this.currentWorkout);
            this.showToast("Đã thay thế bài tập.");
        });
    }

    showExercisePicker(callback) {
        const modal = document.getElementById('exercise-picker-modal');
        const list = document.getElementById('exercise-picker-list');
        let selectedId = null;

        list.innerHTML = this.exercises.map(ex => `
            <div class="exercise-select-item" 
                 onclick="app.selectReplaceExercise('${ex.id}', this)" 
                 style="cursor:pointer;display:flex;align-items:center;padding:12px;border-bottom:1px solid #eee;">
                <div class="exercise-icon" style="font-size:1.6em;margin-right:12px;">${this.getMuscleIcon(ex.muscle)}</div>
                <div>
                    <div style="color: var(--text-primary); font-weight: 500;">${ex.name}</div>
                    <div class="text-muted">${this.getMuscleName(ex.muscle)}</div>
                </div>
            </div>
        `).join('');

        window.app.selectReplaceExercise = function(id, el) {
            document.querySelectorAll('#exercise-picker-list .exercise-select-item').forEach(item => item.classList.remove('selected'));
            el.classList.add('selected');
            selectedId = id;
        };

        document.getElementById('confirm-ex-picker-btn').onclick = () => {
            if (!selectedId) {
                app.showToast("Vui lòng chọn 1 bài tập để thay thế!", "warning");
                return;
            }
            const selectedEx = app.exercises.find(e => e.id === selectedId);
            if (selectedEx) callback(selectedEx);
            modal.classList.remove('active');
        };

        modal.classList.add('active');
    }

    closeExercisePicker() {
        document.getElementById('exercise-picker-modal').classList.remove('active');
    }

    createSuperset(exIndex) {
        this.showExercisePicker((otherExercise) => {
            const supersetId = Date.now() + '-' + Math.random().toString(36).substr(2,5);
            this.currentWorkout.exercises[exIndex].supersetId = supersetId;
            const otherIdx = this.currentWorkout.exercises.findIndex(ex => ex.id === otherExercise.id);
            if (otherIdx > -1) this.currentWorkout.exercises[otherIdx].supersetId = supersetId;
            this.renderWorkoutExercises();
            this.saveData('currentWorkout', this.currentWorkout);
            this.showToast("Đã tạo superset.");
        });
    }

    exercisePreferences(exIndex, event) {
        const ex = this.currentWorkout.exercises[exIndex];
        let unitOptions = ['kg', 'lb'];
        if (ex.type === 'cardio' || /plank|run|minute/i.test(ex.name)) {
            unitOptions = ['minute', 'reps'];
        }
        const currentUnit = ex.unit || unitOptions[0];

        const menu = document.getElementById('unit-context-menu');
        menu.innerHTML = unitOptions.map(u =>
            `<button class="context-menu-btn${u===currentUnit?' selected':''}" data-unit="${u}">${u.toUpperCase()}</button>`
        ).join('');

        let x = event ? event.clientX : window.innerWidth/2, y = event ? event.clientY : window.innerHeight/2;
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.style.display = 'flex';

        menu.querySelectorAll('.context-menu-btn').forEach(btn => {
            btn.onclick = (e2) => {
                const newUnit = btn.getAttribute('data-unit');
                if ((currentUnit === 'kg' && newUnit === 'lb') || (currentUnit === 'lb' && newUnit === 'kg')) {
                    ex.sets.forEach(set => {
                        if (typeof set.weight === 'number') {
                            set.weight = newUnit === 'lb'
                                ? Math.round(set.weight * 2.20462)
                                : Math.round(set.weight / 2.20462);
                        }
                    });
                }
                ex.unit = newUnit;
                this.renderWorkoutExercises();
                this.saveData('currentWorkout', this.currentWorkout);
                this.showToast(`Đã đổi đơn vị sang ${newUnit.toUpperCase()}`);
                menu.style.display = 'none';
            }
        });

        setTimeout(() => {
            document.addEventListener('click', hideMenu, { once: true });
        });
        function hideMenu(e2) {
            if (!menu.contains(e2.target)) menu.style.display = 'none';
        }
    }

    removeExercise(exIndex) {
        if (confirm("Bạn chắc chắn muốn xoá bài tập này khỏi buổi tập?")) {
            this.currentWorkout.exercises.splice(exIndex, 1);
            this.renderWorkoutExercises();
            this.saveData('currentWorkout', this.currentWorkout);
            this.showToast("Đã xoá bài tập.", "success");
        }
    }

    startWorkoutTimer() {
        if (this.workoutTimer) clearInterval(this.workoutTimer);

        const startTime = this.currentWorkout.startTime;
        document.getElementById('workout-timer').textContent = "00:00";

        this.workoutTimer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;

            document.getElementById('workout-timer').textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }

    pauseWorkout() {
        document.getElementById('workout-modal').classList.remove('active');
        this.saveData('currentWorkout', this.currentWorkout);
        this.showToast('Đã tạm dừng, bạn có thể tiếp tục buổi tập từ Trang chủ.', 'info');
    }

    finishWorkout() {
        if (!confirm('Hoàn thành workout?')) return;

        const duration = Math.floor((Date.now() - this.currentWorkout.startTime) / 60000);

        const workout = {
            ...this.currentWorkout,
            duration,
            endTime: Date.now()
        };

        this.workoutHistory.push(workout);
        this.saveData('workoutHistory', this.workoutHistory);

        this.saveData('currentWorkout', null);
        this.currentWorkout = null;

        this.closeWorkout();
        this.showToast('Workout đã được lưu! 💪', 'success');
        this.updateStats();

        this.loadPage(this.currentPage);
        document.getElementById('resume-workout-banner')?.remove();
    }

    closeWorkout() {
        clearInterval(this.workoutTimer);
        
        if (this.setRestIntervals) {
            Object.values(this.setRestIntervals).forEach(clearInterval);
            this.setRestIntervals = {};
        }
        
        document.getElementById('workout-modal').classList.remove('active');
        this.currentWorkout = null;
    }

    // ===== TEMPLATE MANAGEMENT =====
    createTemplate() {
        this.currentTemplate = null;
        this.selectedExercises = [];
        this.selectedExerciseIds = [];
        document.getElementById('template-form-title').textContent = 'Tạo Template';
        document.getElementById('template-form').reset();
        this.renderSelectedExercises();
        document.getElementById('template-modal').classList.add('active');
    }

    editTemplate(templateId) {
        const template = this.templates.find(t => t.id === templateId);
        if (!template) return;
        
        this.currentTemplate = template;
        this.selectedExercises = [...template.exercises];
        this.selectedExerciseIds = template.exercises.map(ex => ex.id);
        
        document.getElementById('template-form-title').textContent = 'Sửa Template';
        document.getElementById('template-name').value = template.name;
        document.getElementById('template-level').value = template.level || '';
        document.getElementById('template-duration').value = template.duration || 60;
        
        this.renderSelectedExercises();
        document.getElementById('template-modal').classList.add('active');
    }

    saveTemplate() {
        const name = document.getElementById('template-name').value.trim();
        const level = document.getElementById('template-level').value;
        const duration = parseInt(document.getElementById('template-duration').value) || 60;
        
        if (!name) {
            this.showToast('Vui lòng nhập tên template', 'error');
            return;
        }
        
        if (this.selectedExercises.length === 0) {
            this.showToast('Vui lòng thêm ít nhất 1 bài tập', 'error');
            return;
        }
        
        const template = {
            id: this.currentTemplate?.id || this.generateId(),
            name,
            level,
            duration,
            exercises: this.selectedExercises,
            createdAt: this.currentTemplate?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        if (this.currentTemplate) {
            const index = this.templates.findIndex(t => t.id === template.id);
            this.templates[index] = template;
        } else {
            this.templates.unshift(template);
        }
        
        this.saveData('templates', this.templates);
        this.closeTemplateForm();
        this.showToast('Template đã được lưu!', 'success');
        
        if (this.currentPage === 'templates') {
            this.renderAllTemplates();
        }
    }

    closeTemplateForm() {
        document.getElementById('template-modal').classList.remove('active');
        this.currentTemplate = null;
        this.selectedExercises = [];
        this.selectedExerciseIds = [];
    }

    selectExercises() {
        this.exerciseSelectSearchValue = '';
        this.renderExerciseSelection();
        document.getElementById('exercise-select-modal').classList.add('active');
    }

    renderExerciseSelection() {
        const container = document.getElementById('exercise-select-list');
        container.innerHTML = this.exercises.map(exercise => {
            const isSelected = this.selectedExerciseIds.includes(exercise.id);
            const muscle = exercise.muscle || exercise.muscleGroup || 'other';
            return `
                <div class="exercise-select-item ${isSelected ? 'selected' : ''}" onclick="app.toggleExerciseSelection('${exercise.id}')">
                    <input type="checkbox" class="exercise-checkbox" ${isSelected ? 'checked' : ''}>
                    <div class="exercise-select-thumb" style="margin-right:12px;">
                        ${exercise.image
                            ? `<img src="${exercise.image}" alt="${exercise.name || ''}" class="exercise-img-thumb" style="width:40px;height:40px;object-fit:cover;border-radius:8px;border:1px solid #ccc;">`
                            : `<div class="exercise-icon" style="font-size:1.5em;">${this.getMuscleIcon(muscle)}</div>`
                        }
                    </div>
                    <div class="exercise-info">
                        <div>${exercise.name || '(No name)'}</div>
                        <div class="text-muted">${this.getMuscleName(muscle)}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    filterExerciseSelection(search) {
        const searchTerm = (search || '').toLowerCase();
        const filtered = this.exercises.filter(exercise => 
            exercise.name.toLowerCase().includes(searchTerm) ||
            this.getMuscleName(exercise.muscle).toLowerCase().includes(searchTerm)
        );
        
        const container = document.getElementById('exercise-select-list');
        if (!container) return;

        if (filtered.length === 0) {
            container.innerHTML = '<div class="text-muted text-center" style="padding: 20px;">Không tìm thấy bài tập nào.</div>';
            return;
        }
        
        container.innerHTML = filtered.map(exercise => {
            const isSelected = this.selectedExerciseIds.includes(exercise.id);
            const muscle = exercise.muscle || exercise.muscleGroup || 'other';
            return `
                <div class="exercise-select-item ${isSelected ? 'selected' : ''}" 
                     onclick="app.toggleExerciseSelection('${exercise.id}')">
                    <input type="checkbox" 
                           class="exercise-checkbox" 
                           ${isSelected ? 'checked' : ''} 
                           readonly>
                    <div class="exercise-info">
                        <div class="exercise-icon">${this.getMuscleIcon(muscle)}</div>
                        <div>
                            <div style="color: var(--text-primary);">${exercise.name}</div>
                            <div class="text-muted">${this.getMuscleName(muscle)}</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    toggleExerciseSelection(id) {
        const idx = this.selectedExerciseIds.indexOf(id);
        if (idx === -1) {
            this.selectedExerciseIds.push(id);
        } else {
            this.selectedExerciseIds.splice(idx, 1);
        }
        this.renderExerciseSelection();
    }

    confirmExerciseSelection() {
        // Get all selected exercises based on selectedExerciseIds
        this.selectedExercises = this.exercises
            .filter(ex => this.selectedExerciseIds.includes(ex.id))
            .map(ex => ({
                ...ex,
                sets: ex.sets && Array.isArray(ex.sets) && ex.sets.length > 0
                    ? ex.sets.map(set => ({ ...set }))
                    : [
                        { targetReps: '8-12', restTime: '1:00', completed: false },
                        { targetReps: '8-12', restTime: '1:00', completed: false },
                        { targetReps: '8-12', restTime: '1:00', completed: false }
                    ],
            }));

        this.closeExerciseSelect();
        this.renderSelectedExercises();
    }

    closeExerciseSelect() {
        document.getElementById('exercise-select-modal').classList.remove('active');
    }

    renderSelectedExercises() {
        const container = document.getElementById('selected-exercises');
        if (this.selectedExercises.length === 0) {
            container.innerHTML = '<div class="text-muted text-center">Chưa có bài tập nào</div>';
            return;
        }
        container.innerHTML = this.selectedExercises.map((exercise, exIndex) => {
            const unitLabel = exercise.unit === 'lb' ? 'lb'
                            : exercise.unit === 'minute' ? 'Min'
                            : exercise.unit === 'second' ? 'Sec'
                            : 'kg';
            const repsLabel = exercise.unit === 'minute' ? 'Minute'
                            : exercise.unit === 'second' ? 'Second'
                            : 'Reps';

            let noteHtml = '';
            if (exercise.note) noteHtml += `<div class="exercise-note" style="color:var(--primary);font-size:0.93em;margin:7px 0 3px 0;">📝 ${exercise.note}</div>`;
            if (exercise.stickyNote) noteHtml += `<div class="exercise-sticky-note" style="color:#FFEB3B;font-weight:bold;margin:0 0 5px 0;">📌 ${exercise.stickyNote}</div>`;

            let setsHtml = `
                <div class="set-row set-row-header">
                    <div class="set-number">Set</div>
                    <div class="set-weight">${unitLabel}</div>
                    <div class="set-reps">${repsLabel}</div>
                    <div class="set-rest">Rest</div>
                    <div class="set-actions"></div>
                </div>
            `;
            exercise.sets.forEach((set, setIndex) => {
                setsHtml += `
                    <div class="set-row">
                        <div class="set-number">${setIndex + 1}</div>
                        <div class="set-weight">
                            <input type="number" class="set-input"
                                value="${set.targetWeight ?? ''}"
                                placeholder="${unitLabel}"
                                onchange="app.updateTemplateSetField(${exIndex}, ${setIndex}, 'targetWeight', this.value)">
                        </div>
                        <div class="set-reps">
                            <input type="text" class="set-input"
                                value="${set.targetReps ?? ''}"
                                placeholder="${repsLabel}"
                                onchange="app.updateTemplateSetField(${exIndex}, ${setIndex}, 'targetReps', this.value)">
                        </div>
                        <div class="set-rest">
                            <input type="text" class="set-input"
                                value="${set.restTime || '1:00'}"
                                placeholder="Rest"
                                onchange="app.updateTemplateSetField(${exIndex}, ${setIndex}, 'restTime', this.value)">
                        </div>
                        <div class="set-actions">
                            <button class="btn-ex-action"
                                onclick="app.removeTemplateSet(${exIndex}, ${setIndex})"
                                title="Xóa set">
                                ❌
                            </button>
                        </div>
                    </div>
                `;
            });

            setsHtml += `
                <div class="add-set-row" style="text-align:right; margin-top:6px;">
                    <button class="btn btn-primary btn-sm" onclick="app.addTemplateSet(${exIndex})">+ Add Set</button>
                </div>
            `;

            return `
                <div class="workout-exercise" style="background:var(--bg-tertiary);border-radius:14px;margin-bottom:18px;padding:16px;">
                    <div class="workout-exercise-header" style="display:flex;align-items:center;justify-content:space-between;">
                        <span class="workout-exercise-name" style="font-size:1.13em;font-weight:600;">
                            ${exercise.name}
                        </span>
                        <div class="exercise-actions" style="display:flex;align-items:center;gap:4px;position:relative;">
                            <button class="btn-ex-action"
                                onclick="app.moveExerciseUp(${exIndex})"
                                title="Di chuyển lên"
                                ${exIndex === 0 ? 'disabled style="opacity:0.5;"' : ''}>
                                ⬆️
                            </button>
                            <button class="btn-ex-action"
                                onclick="app.moveExerciseDown(${exIndex})"
                                title="Di chuyển xuống"
                                ${exIndex === (this.selectedExercises.length-1) ? 'disabled style="opacity:0.5;"' : ''}>
                                ⬇️
                            </button>
							<button class="btn-ex-action"
								onclick="app.toggleExerciseMenu(event, 'template', ${exIndex})"
								title="Tùy chọn">
								<span class="menu-icon">⋯</span>
							</button>

							<div class="exercise-menu" id="edit-menu-template-${exIndex}">
								<button onclick="app.addNoteToTemplateExercise(${exIndex})">📝 Ghi chú</button>
								<button onclick="app.addStickyToTemplateExercise(${exIndex})">📌 Sticky Note</button>
								<button onclick="app.addWarmupSetToTemplate(${exIndex})">➕ Thêm Warm-up Set</button>
								<button onclick="app.updateRestTimersTemplate(${exIndex})">⏱️ Update Rest Timers</button>
								<button onclick="app.replaceExerciseInTemplate(${exIndex})">🔄 Replace Exercise</button>
								<button onclick="app.createSupersetInTemplate(${exIndex})">⎯⎯ Create Superset</button>
								<button onclick="app.exercisePreferencesTemplate(${exIndex}, event)">⚙️ Preferences</button>
								<button onclick="app.duplicateExercise(${exIndex})">📋 Nhân đôi</button>
								<button class="danger" onclick="app.removeSelectedExercise(${exIndex})">❌ Xóa bài</button>
							</div>
                        </div>
                    </div>
                    ${noteHtml}
                    <div class="sets-table">${setsHtml}</div>
                </div>
            `;
        }).join('');
    }

    updateTemplateSetField(exIndex, setIndex, field, value) {
        if (field === 'targetWeight') {
            this.selectedExercises[exIndex].sets[setIndex][field] = value ? parseFloat(value) : '';
        } else {
            this.selectedExercises[exIndex].sets[setIndex][field] = value;
        }
    }

    addTemplateSet(exIndex) {
        this.selectedExercises[exIndex].sets.push({
            targetWeight: '',
            targetReps: '',
            restTime: '1:00',
        });
        this.renderSelectedExercises();
    }

    removeTemplateSet(exIndex, setIndex) {
        this.selectedExercises[exIndex].sets.splice(setIndex, 1);
        this.renderSelectedExercises();
    }

    removeSelectedExercise(index) {
        this.selectedExercises.splice(index, 1);
        this.renderSelectedExercises();
    }

    addNoteToTemplateExercise(exIndex) {
        const ex = this.selectedExercises[exIndex];
        const note = prompt("Ghi chú cho bài này:", ex.note || "");
        if (note !== null) {
            ex.note = note.trim();
            this.renderSelectedExercises();
            this.showToast("Đã lưu ghi chú.");
        }
    }

    addStickyToTemplateExercise(exIndex) {
        const ex = this.selectedExercises[exIndex];
        const sticky = prompt("Sticky note (ghi chú nổi bật):", ex.stickyNote || "");
        if (sticky !== null) {
            ex.stickyNote = sticky.trim();
            this.renderSelectedExercises();
            this.showToast("Đã lưu sticky note.");
        }
    }

    addWarmupSetToTemplate(exIndex) {
        const ex = this.selectedExercises[exIndex];
        const reps = prompt("Số reps cho warm-up set (vd: 10):", "10");
        const weight = prompt("Trọng lượng cho warm-up set (vd: 20):", "20");
        if (reps && weight) {
            ex.sets.unshift({
                targetWeight: parseFloat(weight),
                targetReps: reps,
                restTime: "1:00"
            });
            this.renderSelectedExercises();
            this.showToast("Đã thêm warm-up set.");
        }
    }

    updateRestTimersTemplate(exIndex) {
        const ex = this.selectedExercises[exIndex];
        const rest = prompt("Nhập thời gian nghỉ mới (mm:ss, vd: 1:30):", "1:00");
        if (rest && /^\d{1,2}:\d{2}$/.test(rest)) {
            ex.sets.forEach(set => set.restTime = rest);
            this.renderSelectedExercises();
            this.showToast("Đã cập nhật thời gian nghỉ.");
        } else {
            this.showToast("Định dạng thời gian không hợp lệ.", "warning");
        }
    }

    replaceExerciseInTemplate(exIndex) {
        this.showExercisePicker((newExercise) => {
            this.selectedExercises[exIndex].name = newExercise.name;
            this.selectedExercises[exIndex].muscle = newExercise.muscle;
            this.renderSelectedExercises();
            this.showToast("Đã thay thế bài tập.");
        });
    }

    createSupersetInTemplate(exIndex) {
        this.showExercisePicker((otherExercise) => {
            const supersetId = Date.now() + '-' + Math.random().toString(36).substr(2,5);
            this.selectedExercises[exIndex].supersetId = supersetId;
            const otherIdx = this.selectedExercises.findIndex(ex => ex.id === otherExercise.id);
            if (otherIdx > -1) this.selectedExercises[otherIdx].supersetId = supersetId;
            this.renderSelectedExercises();
            this.showToast("Đã tạo superset.");
        });
    }

    exercisePreferencesTemplate(exIndex, event) {
        const ex = this.selectedExercises[exIndex];
        // Xác định đơn vị phù hợp cho bài tập
        let unitOptions = ['kg', 'lb'];
        if (ex.type === 'cardio' || /plank|run|minute/i.test(ex.name)) {
            unitOptions = ['minute', 'reps'];
        }
        const currentUnit = ex.unit || unitOptions[0];

        // Lấy element menu context
        const menu = document.getElementById('unit-context-menu');

        // Render menu lựa chọn đơn vị
        menu.innerHTML = unitOptions.map(u =>
            `<button class="context-menu-btn${u===currentUnit?' selected':''}" data-unit="${u}">
                ${u==='kg'?'Kilograms (kg)':u==='lb'?'Pounds (lb)':u.charAt(0).toUpperCase()+u.slice(1)}
            </button>`
        ).join('');

        // Hiển thị menu tại vị trí click
        let x = event ? event.clientX : window.innerWidth/2;
        let y = event ? event.clientY : window.innerHeight/2;
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.style.display = 'flex';

        // Gắn sự kiện cho từng nút đổi đơn vị
        menu.querySelectorAll('.context-menu-btn').forEach(btn => {
            btn.onclick = () => {
                const newUnit = btn.getAttribute('data-unit');
                // Nếu đổi kg <-> lb thì chuyển đổi cả số liệu các set
                if ((ex.unit === 'kg' && newUnit === 'lb') ||
                    (ex.unit === 'lb' && newUnit === 'kg')) {
                    if (Array.isArray(ex.sets)) {
                        ex.sets.forEach(set => {
                            if (set.weight) {
                                set.weight = newUnit === 'lb'
                                    ? +(set.weight * 2.20462).toFixed(1)
                                    : +(set.weight / 2.20462).toFixed(1);
                            }
                        });
                    }
                }
                ex.unit = newUnit;
                this.renderSelectedExercises();
                this.showToast(`Đã đổi đơn vị sang ${newUnit === 'kg' ? 'Kilograms (kg)' : newUnit === 'lb' ? 'Pounds (lb)' : newUnit}`);
                menu.style.display = 'none';
            };
        });

        // Ẩn menu khi click ra ngoài
        setTimeout(() => {
            document.addEventListener('click', function handler(e2) {
                if (!menu.contains(e2.target)) menu.style.display = 'none';
                document.removeEventListener('click', handler);
            });
        }, 50);
    }

    // ===== DATA MANAGEMENT =====
    exportData() {
        const data = {
            templates: this.templates,
            exercises: this.exercises,
            workoutHistory: this.workoutHistory,
            exportDate: new Date().toISOString(),
            version: "1.0",
            app: "Gym Tracker"
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gym-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showToast('Dữ liệu đã được xuất! 📤', 'success');
    }

    exportTemplates() {
        const data = {
            templates: this.templates,
            exportDate: new Date().toISOString(),
            version: "1.0",
            app: "Gym Tracker"
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gym-tracker-templates-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showToast('Templates đã được xuất! 📤', 'success');
    }

    importTemplates(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                if (!data.templates || !Array.isArray(data.templates)) {
                    this.showToast('File không hợp lệ (thiếu templates array)', 'error');
                    return;
                }
                
                const action = confirm(`Import ${data.templates.length} templates?`);
                if (!action) return;
                
                data.templates.forEach(template => {
                    template.id = this.generateId();
                    template.importedAt = new Date().toISOString();
                });
                
                this.templates = [...this.templates, ...data.templates];
                this.saveData('templates', this.templates);
                this.renderAllTemplates();
                this.showToast(`Đã import ${data.templates.length} templates! ✅`, 'success');
                
            } catch (err) {
                this.showToast('File không hợp lệ!', 'error');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    handleImportFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);

                if (!data.workoutHistory || !Array.isArray(data.workoutHistory)) {
                    this.showToast('File không hợp lệ (thiếu workoutHistory)', 'error');
                    return;
                }

                this.workoutHistory = data.workoutHistory;
                this.saveData('workoutHistory', this.workoutHistory);

                if (data.templates) {
                    this.templates = data.templates;
                    this.saveData('templates', this.templates);
                }
                if (data.exercises) {
                    this.exercises = data.exercises;
                    this.saveData('exercises', this.exercises);
                }

                this.showToast('Đã import dữ liệu thành công! ✅', 'success');

                if (this.currentPage === 'history') this.renderHistory();

            } catch (err) {
                this.showToast('File không hợp lệ hoặc bị lỗi!', 'error');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    // ===== UTILITIES =====
    closeAllModals() {
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
        });
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    loadData(key) {
        try {
            const data = localStorage.getItem(`gymTracker_${key}`);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Error loading data:', error);
            return null;
        }
    }

    saveData(key, data) {
        try {
            localStorage.setItem(`gymTracker_${key}`, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Error saving data:', error);
            this.showToast('Lỗi lưu dữ liệu', 'error');
            return false;
        }
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${this.getToastIcon(type)}</span>
            <span class="toast-message">${message}</span>
        `;
        
        const container = document.getElementById('toast-container');
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    getToastIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }

    formatDate(dateStr) {
        const date = new Date(dateStr);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (date.toDateString() === today.toDateString()) {
            return 'Hôm nay';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Hôm qua';
        } else {
            return date.toLocaleDateString('vi-VN');
        }
    }

    getTimeAgo(dateStr) {
        const date = new Date(dateStr);
        const now = new Date();
        const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
        
        if (diffInDays === 0) return 'Hôm nay';
        if (diffInDays === 1) return 'Hôm qua';
        if (diffInDays < 7) return `${diffInDays} ngày trước`;
        if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} tuần trước`;
        return `${Math.floor(diffInDays / 30)} tháng trước`;
    }

    getLastWorkout(templateId) {
        return this.workoutHistory
            .filter(w => w.templateId === templateId)
            .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    }

    getLevelText(level) {
        const levels = {
            beginner: '🌱 Người mới',
            intermediate: '⚡ Trung cấp',
            advanced: '🔥 Nâng cao'
        };
        return levels[level] || level;
    }

    // ===== SETTINGS METHODS =====
    openSettings() {
        document.getElementById('settings-modal').classList.add('active');
    }

    closeSettings() {
        document.getElementById('settings-modal').classList.remove('active');
    }

    toggleNotifications() {
        const checked = document.getElementById('enable-notifications').checked;
        localStorage.setItem('gymTracker_notifications', checked ? '1' : '0');
        this.showToast(checked ? 'Đã bật thông báo nghỉ set' : 'Đã tắt thông báo nghỉ set', 'info');
    }

    togglePRNotifications() {
        const checked = document.getElementById('enable-pr-notifications').checked;
        localStorage.setItem('gymTracker_pr_notifications', checked ? '1' : '0');
        this.showToast(checked ? 'Đã bật thông báo PR' : 'Đã tắt thông báo PR', 'info');
    }

    setWeightUnit(unit) {
        localStorage.setItem('gymTracker_weight_unit', unit);
        this.showToast(`Đã đổi đơn vị sang ${unit.toUpperCase()}`, 'info');
    }

    setTheme(theme) {
        localStorage.setItem('gymTracker_theme', theme);
        this.showToast(`Đã đổi theme: ${theme}`, 'info');
    }

    toggleAISuggestions() {
        const checked = document.getElementById('enable-ai-suggestions').checked;
        localStorage.setItem('gymTracker_ai_suggestions', checked ? '1' : '0');
        this.showToast(checked ? 'Đã bật AI suggestions' : 'Đã tắt AI suggestions', 'info');
    }

    toggleFormChecks() {
        const checked = document.getElementById('enable-form-checks').checked;
        localStorage.setItem('gymTracker_form_checks', checked ? '1' : '0');
        this.showToast(checked ? 'Đã bật AI form checks' : 'Đã tắt AI form checks', 'info');
    }

    // ===== BACKEND SETTINGS =====
    openBackendSettings() {
        document.getElementById('backend-settings-modal').classList.add('active');
    }

    closeBackendSettings() {
        document.getElementById('backend-settings-modal').classList.remove('active');
    }

    saveBackendSettings() {
        this.showToast('Backend settings saved', 'success');
        this.closeBackendSettings();
    }

    toggleProviderConfig(provider) {
        document.querySelectorAll('.provider-config').forEach(config => {
            config.style.display = 'none';
        });
        
        if (provider !== 'local') {
            const config = document.getElementById(`${provider}-config`);
            if (config) config.style.display = 'block';
        }
    }

    authenticateOneDrive() {
        this.showToast('OneDrive authentication not implemented yet', 'info');
    }

    manualSync() {
        this.showToast('Manual sync not implemented yet', 'info');
    }

    // ===== AI FEATURES (PLACEHOLDER) =====
    getAIWorkoutSuggestion() {
        this.showToast('AI Workout Suggestion feature coming soon! 🤖', 'info');
    }

    acceptAISuggestion() {
        this.showToast('AI suggestion accepted!', 'success');
        document.getElementById('ai-suggestion-banner').style.display = 'none';
    }

    generateReport() {
        this.showToast('Analytics report generation coming soon! 📊', 'info');
    }

    // ===== ANALYTICS PAGE =====
    loadAnalyticsPage() {
        setTimeout(() => {
            this.initializeAnalytics();
            this.updateAnalyticsSummary();
        }, 100);
    }

    initializeAnalytics() {
        const analytics = this.getAnalytics();
        if (!analytics) return;

        try {
            analytics.createVolumeChart('volume-chart');
            analytics.createMuscleDistributionChart('muscle-distribution-chart');
            analytics.createWorkoutFrequencyChart('frequency-chart');
            analytics.createPRTimeline('pr-chart');
            analytics.createStrengthStandardsChart('strength-chart');
            analytics.createPredictionChart('prediction-chart');
            console.log('✅ Analytics charts initialized');
        } catch (error) {
            console.error('❌ Analytics error:', error);
            this.showToast('Error loading analytics', 'error');
        }
    }

    updateAnalyticsSummary() {
        try {
            const weekStart = new Date();
            weekStart.setDate(weekStart.getDate() - weekStart.getDay());
            weekStart.setHours(0, 0, 0, 0);
            
            const thisWeekWorkouts = this.workoutHistory.filter(w => new Date(w.date) >= weekStart);
            const weeklyVolume = thisWeekWorkouts.reduce((total, workout) => {
                return total + workout.exercises.reduce((sum, ex) => {
                    return sum + ex.sets.reduce((setSum, set) => setSum + ((set.weight || 0) * (set.reps || 0)), 0);
                }, 0);
            }, 0);
            
            const totalVolume = this.workoutHistory.reduce((total, workout) => {
                return total + workout.exercises.reduce((sum, ex) => {
                    return sum + ex.sets.reduce((setSum, set) => setSum + ((set.weight || 0) * (set.reps || 0)), 0);
                }, 0);
            }, 0);
            
            const elements = {
                'weekly-workouts': thisWeekWorkouts.length,
                'weekly-volume': Math.round(weeklyVolume).toLocaleString() + ' kg',
                'weekly-prs': '0',
                'total-workouts-analytics': this.workoutHistory.length,
                'total-volume-analytics': Math.round(totalVolume).toLocaleString() + ' kg',
                'avg-workouts-week': '0.0'
            };
            
            Object.entries(elements).forEach(([id, value]) => {
                const el = document.getElementById(id);
                if (el) el.textContent = value;
            });
        } catch (error) {
            console.error('Error updating summary:', error);
        }
    }

    refreshAnalytics() {
        if (this.currentPage === 'analytics') {
            const analytics = this.getAnalytics();
            if (analytics) analytics.destroyAllCharts();
            this.initializeAnalytics();
            this.updateAnalyticsSummary();
            this.showToast('Analytics refreshed! 📊', 'success');
        }
    }

    // ===== DEFAULT EXERCISES DATA =====
    getDefaultExercises() {
        return [
            // Chest
            { id: '1',  name: 'Bench Press', muscle: 'chest', equipment: 'barbell', type: 'strength',   unit: 'kg' },
            { id: '2',  name: 'Incline Dumbbell Press', muscle: 'chest', equipment: 'dumbbell', type: 'strength', unit: 'kg' },
            { id: '3',  name: 'Push-ups', muscle: 'chest', equipment: 'bodyweight', type: 'bodyweight', unit: 'reps' },
            { id: '4',  name: 'Dumbbell Flyes', muscle: 'chest', equipment: 'dumbbell', type: 'strength', unit: 'kg' },
            { id: '5',  name: 'Decline Bench Press', muscle: 'chest', equipment: 'barbell', type: 'strength', unit: 'kg' },

            // Back
            { id: '6',  name: 'Deadlift', muscle: 'back', equipment: 'barbell', type: 'strength',       unit: 'kg' },
            { id: '7',  name: 'Pull-ups', muscle: 'back', equipment: 'bodyweight', type: 'bodyweight',  unit: 'reps' },
            { id: '8',  name: 'Lat Pulldown', muscle: 'back', equipment: 'cable', type: 'strength',     unit: 'kg' },
            { id: '9',  name: 'Barbell Rows', muscle: 'back', equipment: 'barbell', type: 'strength',   unit: 'kg' },
            { id: '10', name: 'T-Bar Row', muscle: 'back', equipment: 'machine', type: 'strength',      unit: 'kg' },

            // Legs
            { id: '11', name: 'Squat', muscle: 'legs', equipment: 'barbell', type: 'strength',          unit: 'kg' },
            { id: '12', name: 'Leg Press', muscle: 'legs', equipment: 'machine', type: 'strength',      unit: 'kg' },
            { id: '13', name: 'Lunges', muscle: 'legs', equipment: 'dumbbell', type: 'strength',        unit: 'kg' },
            { id: '14', name: 'Leg Curls', muscle: 'legs', equipment: 'machine', type: 'strength',      unit: 'kg' },
            { id: '15', name: 'Calf Raises', muscle: 'legs', equipment: 'machine', type: 'strength',    unit: 'kg' },

            // Shoulders
            { id: '16', name: 'Overhead Press', muscle: 'shoulders', equipment: 'barbell', type: 'strength',   unit: 'kg' },
            { id: '17', name: 'Lateral Raises', muscle: 'shoulders', equipment: 'dumbbell', type: 'strength',  unit: 'kg' },
            { id: '18', name: 'Face Pulls', muscle: 'shoulders', equipment: 'cable', type: 'strength',         unit: 'kg' },
            { id: '19', name: 'Arnold Press', muscle: 'shoulders', equipment: 'dumbbell', type: 'strength',    unit: 'kg' },
            { id: '20', name: 'Upright Rows', muscle: 'shoulders', equipment: 'barbell', type: 'strength',     unit: 'kg' },

            // Arms
            { id: '21', name: 'Bicep Curls', muscle: 'arms', equipment: 'dumbbell', type: 'strength',     unit: 'kg' },
            { id: '22', name: 'Tricep Dips', muscle: 'arms', equipment: 'bodyweight', type: 'bodyweight', unit: 'reps' },
            { id: '23', name: 'Cable Pushdowns', muscle: 'arms', equipment: 'cable', type: 'strength',    unit: 'kg' },
            { id: '24', name: 'Hammer Curls', muscle: 'arms', equipment: 'dumbbell', type: 'strength',    unit: 'kg' },
            { id: '25', name: 'Close-Grip Bench Press', muscle: 'arms', equipment: 'barbell', type: 'strength', unit: 'kg' },

            // Core
            { id: '26', name: 'Plank', muscle: 'core', equipment: 'bodyweight', type: 'bodyweight',       unit: 'minute' },
            { id: '27', name: 'Crunches', muscle: 'core', equipment: 'bodyweight', type: 'bodyweight',    unit: 'reps' },
            { id: '28', name: 'Russian Twists', muscle: 'core', equipment: 'bodyweight', type: 'bodyweight', unit: 'reps' },
            { id: '29', name: 'Dead Bug', muscle: 'core', equipment: 'bodyweight', type: 'bodyweight',    unit: 'reps' },
            { id: '30', name: 'Mountain Climbers', muscle: 'core', equipment: 'bodyweight', type: 'hiit', unit: 'reps' },

            // Cardio & HIIT
            { id: '31', name: 'Treadmill Run', muscle: 'cardio', equipment: 'machine', type: 'cardio',     unit: 'minute' },
            { id: '32', name: 'Cycling', muscle: 'cardio', equipment: 'machine', type: 'cardio',           unit: 'minute' },
            { id: '33', name: 'Rowing Machine', muscle: 'back', equipment: 'machine', type: 'cardio',      unit: 'minute' },
            { id: '34', name: 'Jump Rope', muscle: 'legs', equipment: 'bodyweight', type: 'hiit',          unit: 'reps' },
            { id: '35', name: 'Burpees', muscle: 'fullbody', equipment: 'bodyweight', type: 'hiit',        unit: 'reps' },
            { id: '36', name: 'Box Jump', muscle: 'legs', equipment: 'bodyweight', type: 'plyometrics',    unit: 'reps' },
            { id: '37', name: 'Wall Sit', muscle: 'legs', equipment: 'bodyweight', type: 'bodyweight',     unit: 'minute' },

            // Olympic & Powerlifting
            { id: '38', name: 'Clean and Jerk', muscle: 'olympic', equipment: 'barbell', type: 'strength', unit: 'kg' },
            { id: '39', name: 'Snatch', muscle: 'olympic', equipment: 'barbell', type: 'strength',         unit: 'kg' },
            { id: '40', name: 'Power Clean', muscle: 'olympic', equipment: 'barbell', type: 'strength',    unit: 'kg' },

            // Mobility/Stretching
            { id: '41', name: 'Hamstring Stretch', muscle: 'legs', equipment: 'bodyweight', type: 'stretching', unit: 'second' },
            { id: '42', name: 'Child\'s Pose', muscle: 'back', equipment: 'bodyweight', type: 'stretching', unit: 'second' },
            { id: '43', name: 'Cat-Cow', muscle: 'back', equipment: 'bodyweight', type: 'mobility',        unit: 'second' },
            { id: '44', name: 'Hip Flexor Stretch', muscle: 'legs', equipment: 'bodyweight', type: 'stretching', unit: 'second' },
            { id: '45', name: 'Shoulder Rolls', muscle: 'shoulders', equipment: 'bodyweight', type: 'mobility', unit: 'reps' }
        ];
    }
}

// ===== ADDITIONAL HELPER CLASSES =====

// SupersetManager class
class SupersetManager {
    createSuperset(exercises) {
        const supersetId = this.generateSupersetId();
        
        exercises.forEach(exercise => {
            exercise.supersetId = supersetId;
            exercise.supersetOrder = exercises.indexOf(exercise);
        });
        
        return supersetId;
    }
    
    generateSupersetId() {
        return `superset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    groupBySupersetId(exercises) {
        return exercises.reduce((groups, exercise) => {
            const key = exercise.supersetId || 'null';
            groups[key] = groups[key] || [];
            groups[key].push(exercise);
            return groups;
        }, {});
    }
}

// ExerciseLibrary class
class ExerciseLibrary {
    constructor() {
        this.exercises = [];
        this.categories = {
            compound: ['Bench Press', 'Squat', 'Deadlift', 'Overhead Press', 'Pull-ups'],
            isolation: ['Bicep Curls', 'Tricep Extensions', 'Lateral Raises', 'Leg Curls'],
            cardio: ['Treadmill Run', 'Cycling', 'Rowing Machine', 'Jump Rope'],
            flexibility: ['Hamstring Stretch', 'Shoulder Stretch', 'Hip Flexor Stretch']
        };
        
        this.muscleGroups = {
            push: ['chest', 'shoulders', 'triceps'],
            pull: ['back', 'biceps'],
            legs: ['quads', 'hamstrings', 'glutes', 'calves'],
            core: ['abs', 'obliques', 'lower back']
        };
    }
    
    searchExercises(query, filters = {}) {
        const results = [];
        const searchTerm = query.toLowerCase();
        
        this.exercises.forEach(exercise => {
            const matchesName = exercise.name.toLowerCase().includes(searchTerm);
            const matchesMuscle = !filters.muscle || exercise.muscle === filters.muscle;
            const matchesEquipment = !filters.equipment || exercise.equipment === filters.equipment;
            const matchesType = !filters.type || exercise.type === filters.type;
            
            if (matchesName && matchesMuscle && matchesEquipment && matchesType) {
                results.push({
                    ...exercise,
                    relevance: this.calculateRelevance(exercise, searchTerm)
                });
            }
        });
        
        return results.sort((a, b) => b.relevance - a.relevance);
    }
    
    calculateRelevance(exercise, searchTerm) {
        let score = 0;
        
        if (exercise.name.toLowerCase() === searchTerm) score += 10;
        if (exercise.name.toLowerCase().startsWith(searchTerm)) score += 5;
        if (exercise.name.toLowerCase().includes(searchTerm)) score += 3;
        if (this.categories.compound.includes(exercise.name)) score += 2;
        
        return score;
    }
    
    getSimilarExercises(exerciseId) {
        const exercise = this.exercises.find(e => e.id === exerciseId);
        if (!exercise) return [];
        
        return this.exercises.filter(e => 
            e.id !== exerciseId &&
            (e.muscle === exercise.muscle || e.equipment === exercise.equipment)
        ).slice(0, 5);
    }
}

// NotificationManager class
class NotificationManager {
    constructor() {
        this.permission = 'default';
        this.checkPermission();
    }
    
    async checkPermission() {
        if ('Notification' in window) {
            this.permission = Notification.permission;
            if (this.permission === 'default') {
                this.permission = await Notification.requestPermission();
            }
        }
    }
    
    notify(title, options = {}) {
        if (this.permission === 'granted') {
            const notification = new Notification(title, {
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-192x192.png',
                vibrate: [200, 100, 200],
                ...options
            });
            
            notification.onclick = () => {
                window.focus();
                notification.close();
            };
            
            setTimeout(() => notification.close(), 5000);
        }
    }
    
    notifyRestComplete() {
        this.notify('Rest Time Complete! 💪', {
            body: 'Time for your next set!',
            tag: 'rest-timer'
        });
    }
    
    notifyWorkoutMilestone(milestone) {
        this.notify(`Milestone Achieved! 🎉`, {
            body: milestone,
            tag: 'milestone'
        });
    }
}

// ===== EVENT HANDLERS =====

// Window resize handler to reposition menus
window.addEventListener('resize', function() {
    // Close menus on resize to prevent positioning issues
    if (window.app) {
        app.closeAllMenus();
    }
});

// Scroll handler to reposition or close menus
window.addEventListener('scroll', function() {
    // Reposition visible menus or close them
    const visibleMenus = document.querySelectorAll('.exercise-menu[style*="display: block"]');
    if (visibleMenus.length > 0 && window.app) {
        // For now, just close them on scroll
        app.closeAllMenus();
    }
});

// ===== APP INITIALIZATION =====
try {
    const app = new GymTracker();
    window.app = app;
    console.log('✅ Gym Tracker initialized successfully');
    
    // Auto-save functionality
    setInterval(() => {
        if (app.currentWorkout && !app.currentWorkout.endTime) {
            app.saveData('currentWorkout', app.currentWorkout);
        }
    }, 30000); // Auto-save every 30 seconds
    
} catch (error) {
    console.error('❌ App initialization failed:', error);
    document.body.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;text-align:center;padding:20px;">
            <h1 style="color:#f44336;margin-bottom:16px;">🚨 Initialization Error</h1>
            <p style="color:#666;margin-bottom:20px;">Failed to load Gym Tracker. Please refresh the page.</p>
            <button onclick="location.reload()" style="padding:12px 24px;background:#4CAF50;color:white;border:none;border-radius:8px;cursor:pointer;">
                🔄 Refresh Page
            </button>
        </div>
    `;
}
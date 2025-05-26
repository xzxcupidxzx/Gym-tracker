// js/app.js - Fixed Modern Gym Tracker Application
function playBeep() {
    const beep = document.getElementById('sound-beep');
    if (beep) {
        beep.currentTime = 0;
        beep.volume = 0.2;
        beep.play();
    }
}
function playDone() {
    const done = document.getElementById('sound-done');
    if (done) {
        done.currentTime = 0;
        done.volume = 0.4;
        done.play();
    }
}

class GymTracker {
	constructor() {
		// Biến trạng thái
		this.currentPage = 'home';
		this.currentWorkout = null;
		this.currentTemplate = null;
		this.selectedExercises = [];
		this.workoutTimer = null;
		this.restTimer = null;

		// Load data từ localStorage
		this.templates = this.loadData('templates') || [];
		this.exercises = this.loadData('exercises') || this.getDefaultExercises();
		this.currentExerciseSearch = '';
		this.mergeDefaultExercises();
		this.workoutHistory = this.loadData('workoutHistory') || [];
		
		this.supersetManager = new SupersetManager();
		this.exerciseLibrary = new ExerciseLibrary();
		this.exerciseLibrary.exercises = this.exercises;
		this.notifications = new NotificationManager();
		this.exerciseSelectSearchValue = '';

		// Initialize
		this.init();
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

	init() {
        this.setupEventListeners();
        this.loadPage(this.currentPage);
        this.updateStats();
        
        if (!this.loadData('exercises')) {
            this.saveData('exercises', this.exercises);
        }
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
		if (added) this.saveData('exercises', userExercises);
	}
    
    setupEventListeners() {
		document.querySelectorAll('.nav-link').forEach(link => {
		  link.addEventListener('click', (e) => {
			e.preventDefault();
			const page = link.dataset.page;
			this.loadPage(page);
		  });
		});

        const menuToggle = document.getElementById('menu-toggle');
        if (menuToggle) {
            menuToggle.addEventListener('click', () => {
                menuToggle.classList.toggle('active');
            });
        }
		const notificationToggle = document.getElementById('enable-notifications');
		if (notificationToggle) {
		  notificationToggle.checked = localStorage.getItem('gymTracker_notifications') !== '0';
		  notificationToggle.addEventListener('change', function() {
			localStorage.setItem('gymTracker_notifications', this.checked ? '1' : '0');
		  });
		}

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
        
        document.getElementById('template-filter')?.addEventListener('change', (e) => {
            this.filterTemplates('', e.target.value);
        });
        
        document.getElementById('muscle-filter')?.addEventListener('change', (e) => {
            this.filterExercises('', e.target.value);
        });
    }
    
    loadPage(page) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.page === page);
        });
        
        document.querySelectorAll('.page').forEach(pageEl => {
            pageEl.classList.toggle('active', pageEl.id === `${page}-page`);
        });
        
        this.currentPage = page;
        
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
				setTimeout(() => {
					const analytics = this.getAnalytics();
					if (analytics) {
						analytics.createVolumeChart('volume-chart');
						analytics.createMuscleDistributionChart('muscle-distribution-chart');
						analytics.createPRTimeline('pr-chart');
						analytics.createStrengthStandardsChart('strength-chart');
					}
				}, 100);
				break;
		}
	}
    
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
				<div id="resume-workout-banner" class="resume-workout-banner" style="margin-bottom:16px;display:flex;gap:12px;align-items:center;">
					<div style="flex:1;">
						<b>Buổi tập chưa hoàn thành:</b> <span style="color:var(--primary);font-weight:600;">${templateName}</span>
					</div>
					<button class="icon-btn btn-primary" title="Tiếp tục" onclick="app.resumeWorkout()" style="margin-right:4px;"><span style="font-size:1.35em;">▶️</span></button>
					<button class="icon-btn btn-secondary" title="Sửa" onclick="app.editResumeWorkout()" style="margin-right:4px;"><span style="font-size:1.22em;">✏️</span></button>
					<button class="icon-btn btn-danger" title="Xóa" onclick="app.deleteResumeWorkout()"><span style="font-size:1.22em;">🗑️</span></button>
				</div>
			`);
		}
        if (recentTemplates.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📋</div>
                    <div class="empty-title">Chưa có template nào</div>
                    <div class="empty-text">Tạo template đầu tiên để bắt đầu</div>
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
                    <button class="btn btn-primary" onclick="app.createTemplate()">
                        Tạo template
                    </button>
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
    
    loadExercisesPage() {
        this.renderAllExercises();
    }
    
    renderAllExercises() {
        const container = document.getElementById('all-exercises');
        
        if (this.exercises.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🏋️</div>
                    <div class="empty-title">Chưa có bài tập nào</div>
                    <div class="empty-text">Thêm bài tập để sử dụng trong templates</div>
                    <button class="btn btn-primary" onclick="app.createExercise()">
                        Thêm bài tập
                    </button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.exercises.map(exercise => 
            this.createExerciseCard(exercise)
        ).join('');
    }

	openEditExerciseModal(exerciseId) {
		this.editingExerciseId = exerciseId;
		const exercise = this.exercises.find(e => e.id === exerciseId);
		if (!exercise) return this.showToast("Không tìm thấy bài tập!", "error");

		document.getElementById('exercise-edit-name').value = exercise.name || '';
		document.getElementById('exercise-edit-muscle').value = exercise.muscle || '';
		document.getElementById('exercise-edit-type').value = exercise.type || 'strength';
		document.getElementById('exercise-edit-equipment').value = exercise.equipment || '';
		document.getElementById('exercise-edit-unit').value = exercise.unit || 'kg';

		document.getElementById('exercise-edit-modal').classList.add('active');
	}

	closeEditExerciseModal() {
		document.getElementById('exercise-edit-modal').classList.remove('active');
		this.editingExerciseId = null;
	}

	saveEditExercise() {
		const id = this.editingExerciseId;
		const exercise = this.exercises.find(e => e.id === id);
		if (!exercise) return this.showToast("Không tìm thấy bài tập!", "error");

		const name = document.getElementById('exercise-edit-name').value.trim();
		const muscle = document.getElementById('exercise-edit-muscle').value;
		const type = document.getElementById('exercise-edit-type').value;
		const equipment = document.getElementById('exercise-edit-equipment').value.trim();
		const unit = document.getElementById('exercise-edit-unit').value;

		if (!name) return this.showToast("Tên bài tập không được để trống", "error");

		exercise.name = name;
		exercise.muscle = muscle;
		exercise.type = type;
		exercise.equipment = equipment;
		exercise.unit = unit;

		this.saveData('exercises', this.exercises);
		this.renderAllExercises();
		this.closeEditExerciseModal();
		this.showToast("Đã cập nhật bài tập!", "success");
	}

	exportExercises() {
		const data = this.exercises;
		const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `exercises-backup-${new Date().toISOString().split('T')[0]}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		this.showToast('Đã xuất danh sách bài tập!', 'success');
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
				if (!Array.isArray(data)) {
					this.showToast('File không hợp lệ (không phải mảng)', 'error');
					return;
				}
				if (!confirm('Import sẽ thay thế toàn bộ danh sách bài tập hiện tại. Tiếp tục?')) return;
				this.exercises = data;
				this.saveData('exercises', this.exercises);
				this.renderAllExercises();
				this.showToast('Đã import danh sách bài tập thành công!', 'success');
			} catch (err) {
				this.showToast('File không hợp lệ hoặc bị lỗi!', 'error');
			}
		};
		reader.readAsText(file);
	}
	
	openAddExerciseModal() {
		document.getElementById('exercise-add-form').reset();
		document.getElementById('exercise-add-modal').classList.add('active');
		document.querySelectorAll('#exercise-add-muscle-group .chip-btn').forEach(btn => btn.classList.remove('selected'));
		document.getElementById('exercise-add-muscle').value = '';
		if (!window._muscleChipSetup) {
			document.querySelectorAll('#exercise-add-muscle-group .chip-btn').forEach(btn => {
				btn.onclick = function() {
					document.querySelectorAll('#exercise-add-muscle-group .chip-btn').forEach(b => b.classList.remove('selected'));
					btn.classList.add('selected');
					document.getElementById('exercise-add-muscle').value = btn.dataset.value;
				};
			});
			window._muscleChipSetup = true;
		}
	}

	closeAddExerciseModal() {
		document.getElementById('exercise-add-modal').classList.remove('active');
	}

	saveAddExercise() {
		const name = document.getElementById('exercise-add-name').value.trim();
		const muscle = document.getElementById('exercise-add-muscle').value;
		const type = document.getElementById('exercise-add-type').value;
		const equipment = document.getElementById('exercise-add-equipment').value;
		const unit = document.getElementById('exercise-add-unit').value;

		if (!name) return this.showToast("Tên bài tập không được để trống!", "error");
		if (!muscle) return this.showToast("Vui lòng chọn nhóm cơ!", "error");

		if (this.exercises.some(e => e.name.toLowerCase() === name.toLowerCase() && e.muscle === muscle)) {
			this.showToast("Bài tập đã tồn tại!", "warning");
			return;
		}

		const newExercise = {
			id: this.generateId(),
			name,
			muscle,
			type,
			equipment,
			unit
		};

		this.exercises.push(newExercise);
		this.saveData('exercises', this.exercises);
		this.renderAllExercises();
		this.closeAddExerciseModal();
		this.showToast("Đã thêm bài tập mới!", "success");
	}

	createExerciseCard(exercise) {
		return `
			<div class="exercise-card">
				<div class="exercise-icon">${this.getMuscleIcon(exercise.muscle)}</div>
				<div class="exercise-name">${exercise.name}</div>
				<div class="exercise-muscle">${this.getMuscleName(exercise.muscle)}</div>
				<div class="exercise-actions" style="margin-top:6px;display:flex;gap:4px;">
					<button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); app.openEditExerciseModal('${exercise.id}')">✏️ Sửa</button>
					<button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); app.deleteExercise('${exercise.id}')">🗑️ Xóa</button>
				</div>
			</div>
		`;
	}

	createExercise() {
		const name = prompt("Tên bài tập mới:");
		if (!name) return;
		const muscle = prompt("Nhóm cơ (chest, back, legs, shoulders, arms, core):", "chest");
		if (!muscle) return;
		const newExercise = {
			id: this.generateId(),
			name: name.trim(),
			muscle: muscle.trim(),
			equipment: '',
			type: 'strength',
			unit: 'kg'
		};
		this.exercises.push(newExercise);
		this.saveData('exercises', this.exercises);
		this.renderAllExercises();
		this.showToast("Đã thêm bài tập mới!", "success");
	}

	editExercise(exerciseId) {
		const exercise = this.exercises.find(e => e.id === exerciseId);
		if (!exercise) return this.showToast("Không tìm thấy bài tập!", "error");
		const newName = prompt("Sửa tên bài tập:", exercise.name);
		if (newName !== null && newName.trim() !== "") {
			exercise.name = newName.trim();
			this.saveData('exercises', this.exercises);
			this.renderAllExercises();
			this.showToast("Đã cập nhật tên bài tập!", "success");
		}
	}

	deleteExercise(exerciseId) {
		if (!confirm("Bạn chắc chắn muốn xóa bài tập này?")) return;
		const idx = this.exercises.findIndex(e => e.id === exerciseId);
		if (idx > -1) {
			this.exercises.splice(idx, 1);
			this.saveData('exercises', this.exercises);
			this.renderAllExercises();
			this.showToast("Đã xóa bài tập.", "success");
		}
	}

    filterExercises(search = '', muscle = '') {
        const searchInput = document.getElementById('exercise-search');
        const filterSelect = document.getElementById('muscle-filter');
        
        search = search || searchInput?.value || '';
        muscle = muscle || filterSelect?.value || '';
        
        const filtered = this.exercises.filter(exercise => {
            const matchesSearch = !search || 
                exercise.name.toLowerCase().includes(search.toLowerCase());
            const matchesMuscle = !muscle || exercise.muscle === muscle;
            return matchesSearch && matchesMuscle;
        });
        
        const container = document.getElementById('all-exercises');
        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-text">Không tìm thấy bài tập nào</div></div>';
        } else {
            container.innerHTML = filtered.map(exercise => 
                this.createExerciseCard(exercise)
            ).join('');
        }
    }
    
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

	editResumeWorkout() {
		const cachedWorkout = this.loadData('currentWorkout');
		if (!cachedWorkout) return;
		alert('Bạn có thể sửa trực tiếp trong khi tập. (Có thể mở rộng UX này)');
		this.resumeWorkout();
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

	// ✅ FIXED: Properly transfer template data to workout
	startWorkout(templateId) {
		const cachedWorkout = this.loadData('currentWorkout');
		if (
			cachedWorkout &&
			!cachedWorkout.endTime &&
			cachedWorkout.templateId === templateId
		) {
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

		// ✅ FIX: Properly transfer target values to actual values
		this.currentWorkout = {
			id: this.generateId(),
			templateId: template.id,
			date: new Date().toISOString(),
			startTime: Date.now(),
			exercises: template.exercises.map(ex => ({
				...ex,
				sets: ex.sets.map(set => ({
					weight: set.targetWeight || 0,
					reps: set.targetReps || 0,
					targetWeight: set.targetWeight || 0,
					targetReps: set.targetReps || '',
					restTime: set.restTime || '1:00',
					completed: false,
					isWarmup: set.isWarmup || false,
					previous: set.previous || ''
				})),
				restAfterLastSet: ex.restAfterLastSet || "1:00"
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

	// ✅ IMPROVED: Better workout exercise rendering with fixed layout
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
			if (exercise.note) noteHtml += `<div class="exercise-note">📝 ${exercise.note}</div>`;
			if (exercise.stickyNote) noteHtml += `<div class="exercise-sticky-note">📌 ${exercise.stickyNote}</div>`;

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
				<div class="add-set-row">
					<button class="btn btn-primary btn-sm" onclick="app.addSet(${exIndex})">+ Add Set</button>
				</div>
			`;

			// ✅ IMPROVED: Better exercise header layout
			container.innerHTML += `
				<div class="workout-exercise">
					<div class="workout-exercise-header">
						<div class="exercise-title-section">
							<span class="workout-exercise-name">${exercise.name}</span>
							<div class="exercise-meta">
								<span class="exercise-muscle">${this.getMuscleName(exercise.muscle)}</span>
							</div>
						</div>
						<div class="exercise-actions">
							<button class="btn-ex-action" onclick="app.toggleEditMenu(event, ${exIndex})">
								<span class="menu-icon">⋯</span>
							</button>
							<div class="exercise-menu" id="edit-menu-${exIndex}" style="display:none;">
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

	closeAllModals() {
		document.querySelectorAll('.modal.active').forEach(modal => {
			modal.classList.remove('active');
		});
	}
	
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
			if (timeLeft > 0 && timeLeft <= 10) playBeep();
			if (timeLeft <= 0) {
				clearInterval(this.setRestIntervals[`${exIndex}-${setIndex}`]);
				timerSpan.textContent = "Done";
				progressBar.style.width = '0%';
				playDone();
			}
		}, 1000);
	}

	formatTime(seconds) {
		const m = Math.floor(seconds / 60).toString();
		const s = (seconds % 60).toString().padStart(2, "0");
		return `${m}:${s}`;
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
			if (timeLeft > 0 && timeLeft <= 10) playBeep();
			if (timeLeft <= 0) {
				clearInterval(this.setRestIntervals[`last-${exIndex}`]);
				timerSpan.textContent = "Done";
				progressBar.style.width = '0%';
				playDone();
			}
		}, 1000);
	}

    updateSet(exIndex, setIndex, field, value) {
        this.currentWorkout.exercises[exIndex].sets[setIndex][field] = parseFloat(value) || 0;
		// Auto-save after each change
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
	}
	
	toggleEditMenu(e, exIndex) {
		e.stopPropagation();
		document.querySelectorAll('.exercise-menu').forEach(menu => menu.style.display = 'none');
		const menu = document.getElementById(`edit-menu-${exIndex}`);
		if (menu) {
			if (menu.style.display === 'block') {
				menu.style.display = 'none';
			} else {
				menu.style.display = 'block';
				setTimeout(() => {
					function hideMenu(ev) {
						if (!menu.contains(ev.target) && ev.target !== e.target) {
							menu.style.display = 'none';
							document.removeEventListener('click', hideMenu);
						}
					}
					document.addEventListener('click', hideMenu);
				}, 0);
			}
		}
	}

	addExerciseNote(exIndex) {
		const ex = this.currentWorkout.exercises[exIndex];
		const note = prompt("Ghi chú cho bài này:", ex.note || "");
		if (note !== null) {
			ex.note = note.trim();
			this.renderWorkoutExercises();
			this.showToast("Đã lưu ghi chú.");
		}
	}

	addExerciseSticky(exIndex) {
		const ex = this.currentWorkout.exercises[exIndex];
		const sticky = prompt("Sticky note (ghi chú nổi bật):", ex.stickyNote || "");
		if (sticky !== null) {
			ex.stickyNote = sticky.trim();
			this.renderWorkoutExercises();
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
    
    createTemplate() {
        this.currentTemplate = null;
        this.selectedExercises = [];
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
    }
    
	selectExercises() {
		this.exerciseSelectSearchValue = '';
		this.renderExerciseSelection();
		document.getElementById('exercise-select-modal').classList.add('active');
	}
    
    renderExerciseSelection() {
        const container = document.getElementById('exercise-select-list');
        
        container.innerHTML = this.exercises.map(exercise => {
            const isSelected = this.selectedExercises.some(ex => ex.id === exercise.id);
            
            return `
                <div class="exercise-select-item ${isSelected ? 'selected' : ''}" 
                     onclick="app.toggleExerciseSelection('${exercise.id}')">
                    <input type="checkbox" 
                           class="exercise-checkbox" 
                           ${isSelected ? 'checked' : ''}>
                    <div class="exercise-info">
                        <div class="exercise-icon">${this.getMuscleIcon(exercise.muscle)}</div>
                        <div>
                            <div>${exercise.name}</div>
                            <div class="text-muted">${this.getMuscleName(exercise.muscle)}</div>
                        </div>
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
			const isSelected = this.selectedExercises.some(ex => ex.id === exercise.id);
			return `
				<div class="exercise-select-item ${isSelected ? 'selected' : ''}" 
					 onclick="app.toggleExerciseSelection('${exercise.id}')">
					<input type="checkbox" 
						   class="exercise-checkbox" 
						   ${isSelected ? 'checked' : ''} 
						   readonly>
					<div class="exercise-info">
						<div class="exercise-icon">${this.getMuscleIcon(exercise.muscle)}</div>
						<div>
							<div style="color: var(--text-primary);">${exercise.name}</div>
							<div class="text-muted">${this.getMuscleName(exercise.muscle)}</div>
						</div>
					</div>
				</div>
			`;
		}).join('');
    }
    
	toggleExerciseSelection(exerciseId) {
		const exercise = this.exercises.find(ex => ex.id === exerciseId);
		if (!exercise) return;

		const index = this.selectedExercises.findIndex(ex => ex.id === exerciseId);
		if (index >= 0) {
			this.selectedExercises.splice(index, 1);
		} else {
			this.selectedExercises.push({
				id: exercise.id,
				name: exercise.name,
				muscle: exercise.muscle,
				equipment: exercise.equipment,
				type: exercise.type,
				unit: exercise.unit,
				sets: [
					{ targetReps: '8-12', restTime: '1:00', completed: false },
					{ targetReps: '8-12', restTime: '1:00', completed: false },
					{ targetReps: '8-12', restTime: '1:00', completed: false }
				]
			});
		}
		this.filterExerciseSelection(this.exerciseSelectSearchValue || '');
	}
    
    confirmExerciseSelection() {
        this.closeExerciseSelect();
        this.renderSelectedExercises();
    }
    
    closeExerciseSelect() {
        document.getElementById('exercise-select-modal').classList.remove('active');
    }
    
	// ✅ IMPROVED: Better template editor with move buttons outside
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
			if (exercise.note) noteHtml += `<div class="exercise-note">📝 ${exercise.note}</div>`;
			if (exercise.stickyNote) noteHtml += `<div class="exercise-sticky-note">📌 ${exercise.stickyNote}</div>`;

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
							<button class="btn-ex-action" style="font-size:1.2em"
								onclick="app.removeTemplateSet(${exIndex},${setIndex})" title="Xóa set">×</button>
						</div>
					</div>
				`;
			});

			setsHtml += `
				<div class="add-set-row">
					<button class="btn btn-primary btn-sm" onclick="app.addTemplateSet(${exIndex})">+ Add Set</button>
				</div>
			`;

			// ✅ IMPROVED: Move buttons outside in separate section
			return `
			<div class="workout-exercise template-exercise">
				<div class="template-exercise-header">
					<div class="exercise-title-section">
						<span class="workout-exercise-name">${exercise.name}</span>
						<div class="exercise-meta">
							<span class="exercise-muscle">${this.getMuscleName(exercise.muscle)}</span>
						</div>
					</div>
					<div class="exercise-controls">
						<div class="move-controls">
							<button class="btn-move" onclick="app.moveExerciseUp(${exIndex})" 
								${exIndex === 0 ? 'disabled' : ''} title="Move Up">
								<span>⬆️</span>
							</button>
							<button class="btn-move" onclick="app.moveExerciseDown(${exIndex})" 
								${exIndex === this.selectedExercises.length - 1 ? 'disabled' : ''} title="Move Down">
								<span>⬇️</span>
							</button>
						</div>
						<div class="exercise-actions">
							<button class="btn-ex-action" onclick="app.toggleEditMenu(event, ${exIndex})" title="Options">
								<span class="menu-icon">⋯</span>
							</button>
							<div class="exercise-menu" id="edit-menu-${exIndex}" style="display:none;">
								<button onclick="app.addNoteToTemplateExercise(${exIndex})">📝 Ghi chú</button>
								<button onclick="app.addStickyToTemplateExercise(${exIndex})">📌 Sticky Note</button>
								<button onclick="app.addWarmupSetToTemplate(${exIndex})">➕ Thêm Warm-up Set</button>
								<button onclick="app.updateRestTimersTemplate(${exIndex})">⏱️ Update Rest Timers</button>
								<button onclick="app.replaceExerciseInTemplate(${exIndex})">🔄 Replace Exercise</button>
								<button onclick="app.createSupersetInTemplate(${exIndex})">⎯⎯ Create Superset</button>
								<button onclick="app.exercisePreferencesTemplate(${exIndex}, event)">⚙️ Preferences</button>
								<button class="danger" onclick="app.removeSelectedExercise(${exIndex})">❌ Xóa bài</button>
							</div>
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

	moveExerciseUp(exIndex) {
		if (exIndex <= 0) return;
		const tmp = this.selectedExercises[exIndex];
		this.selectedExercises[exIndex] = this.selectedExercises[exIndex - 1];
		this.selectedExercises[exIndex - 1] = tmp;
		this.renderSelectedExercises();
	}

	moveExerciseDown(exIndex) {
		if (exIndex >= this.selectedExercises.length - 1) return;
		const tmp = this.selectedExercises[exIndex];
		this.selectedExercises[exIndex] = this.selectedExercises[exIndex + 1];
		this.selectedExercises[exIndex + 1] = tmp;
		this.renderSelectedExercises();
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
			btn.onclick = () => {
				ex.unit = btn.getAttribute('data-unit');
				this.renderSelectedExercises();
				this.showToast(`Đã đổi đơn vị sang ${ex.unit.toUpperCase()}`);
				menu.style.display = 'none';
			};
		});
		setTimeout(() => {
			document.addEventListener('click', hideMenu, { once: true });
		});
		function hideMenu(e2) {
			if (!menu.contains(e2.target)) menu.style.display = 'none';
		}
	}
    
    exportData() {
        const data = {
            templates: this.templates,
            exercises: this.exercises,
            workoutHistory: this.workoutHistory,
            exportDate: new Date().toISOString()
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
        
        this.showToast('Dữ liệu đã được xuất!', 'success');
    }

	handleImportFile(event) {
		const file = event.target.files[0];
		if (!file) {
			this.showToast('Không có file nào được chọn.', 'warning');
			return;
		}
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

				this.showToast('Đã import dữ liệu thành công!', 'success');

				if (this.currentPage === 'history') this.renderHistory();

			} catch (err) {
				this.showToast('File không hợp lệ hoặc bị lỗi!', 'error');
			}
		};
		reader.readAsText(file);
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
    
    getMuscleIcon(muscle) {
        const icons = {
            chest: '💪',
            back: '🔙',
            legs: '🦵',
            shoulders: '💪',
            arms: '💪',
            core: '🔥'
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
            core: 'Bụng'
        };
        return names[muscle] || muscle;
    }

	getDefaultExercises() {
		return [
			// Chest
			{ id: '1',  name: 'Bench Press', muscle: 'chest', equipment: 'barbell', type: 'strength',   unit: 'kg' },
			{ id: '2',  name: 'Incline Dumbbell Press', muscle: 'chest', equipment: 'dumbbell', type: 'strength', unit: 'kg' },
			{ id: '3',  name: 'Push-ups', muscle: 'chest', equipment: 'bodyweight', type: 'bodyweight', unit: 'reps' },

			// Back
			{ id: '4',  name: 'Deadlift', muscle: 'back', equipment: 'barbell', type: 'strength',       unit: 'kg' },
			{ id: '5',  name: 'Pull-ups', muscle: 'back', equipment: 'bodyweight', type: 'bodyweight',  unit: 'reps' },
			{ id: '6',  name: 'Lat Pulldown', muscle: 'back', equipment: 'cable', type: 'strength',     unit: 'kg' },

			// Legs
			{ id: '7',  name: 'Squat', muscle: 'legs', equipment: 'barbell', type: 'strength',          unit: 'kg' },
			{ id: '8',  name: 'Leg Press', muscle: 'legs', equipment: 'machine', type: 'strength',      unit: 'kg' },
			{ id: '9',  name: 'Lunges', muscle: 'legs', equipment: 'dumbbell', type: 'strength',        unit: 'kg' },

			// Shoulders
			{ id: '10', name: 'Overhead Press', muscle: 'shoulders', equipment: 'barbell', type: 'strength',   unit: 'kg' },
			{ id: '11', name: 'Lateral Raises', muscle: 'shoulders', equipment: 'dumbbell', type: 'strength',  unit: 'kg' },
			{ id: '12', name: 'Face Pulls', muscle: 'shoulders', equipment: 'cable', type: 'strength',         unit: 'kg' },

			// Arms
			{ id: '13', name: 'Bicep Curls', muscle: 'arms', equipment: 'dumbbell', type: 'strength',     unit: 'kg' },
			{ id: '14', name: 'Tricep Dips', muscle: 'arms', equipment: 'bodyweight', type: 'bodyweight', unit: 'reps' },
			{ id: '15', name: 'Cable Pushdowns', muscle: 'arms', equipment: 'cable', type: 'strength',    unit: 'kg' },

			// Core
			{ id: '16', name: 'Plank', muscle: 'core', equipment: 'bodyweight', type: 'bodyweight',       unit: 'minute' },
			{ id: '17', name: 'Crunches', muscle: 'core', equipment: 'bodyweight', type: 'bodyweight',    unit: 'reps' },
			{ id: '18', name: 'Russian Twists', muscle: 'core', equipment: 'bodyweight', type: 'bodyweight', unit: 'reps' },

			// Cardio & HIIT
			{ id: '19', name: 'Treadmill Run', muscle: 'legs', equipment: 'machine', type: 'cardio',     unit: 'minute' },
			{ id: '20', name: 'Cycling', muscle: 'legs', equipment: 'machine', type: 'cardio',           unit: 'minute' },
			{ id: '21', name: 'Rowing Machine', muscle: 'back', equipment: 'machine', type: 'cardio',    unit: 'minute' },
			{ id: '22', name: 'Jump Rope', muscle: 'legs', equipment: 'bodyweight', type: 'hiit',        unit: 'reps' },
			{ id: '23', name: 'Mountain Climber', muscle: 'core', equipment: 'bodyweight', type: 'hiit', unit: 'reps' },
			{ id: '24', name: 'Burpees', muscle: 'fullbody', equipment: 'bodyweight', type: 'hiit',      unit: 'reps' },
			{ id: '25', name: 'Box Jump', muscle: 'legs', equipment: 'bodyweight', type: 'plyometrics',  unit: 'reps' },
			{ id: '26', name: 'Wall Sit', muscle: 'legs', equipment: 'bodyweight', type: 'bodyweight',   unit: 'minute' },

			// Mobility/Stretching
			{ id: '27', name: 'Hamstring Stretch', muscle: 'legs', equipment: 'bodyweight', type: 'stretching', unit: 'second' },
			{ id: '28', name: 'Child\'s Pose', muscle: 'back', equipment: 'bodyweight', type: 'stretching', unit: 'second' },
			{ id: '29', name: 'Cat-Cow', muscle: 'back', equipment: 'bodyweight', type: 'mobility',      unit: 'second' }
		];
	}
}

// Additional classes remain the same...
class AutoSaveManager {
    constructor(gymTracker) {
        this.app = gymTracker;
        this.saveInterval = null;
        this.startAutoSave();
    }
    
    startAutoSave() {
        this.saveInterval = setInterval(() => {
            if (this.app.currentWorkout && !this.app.currentWorkout.endTime) {
                this.app.saveData('currentWorkout', this.app.currentWorkout);
                console.log('Auto-saved workout progress');
            }
        }, 30000);
    }
    
    stop() {
        if (this.saveInterval) {
            clearInterval(this.saveInterval);
            this.saveInterval = null;
        }
    }
}

class ExerciseHistoryTracker {
    constructor(gymTracker) {
        this.app = gymTracker;
    }
    
    getExerciseHistory(exerciseId, limit = 10) {
        const history = [];
        
        this.app.workoutHistory
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .forEach(workout => {
                const exercise = workout.exercises.find(e => e.id === exerciseId);
                if (exercise && history.length < limit) {
                    history.push({
                        date: workout.date,
                        sets: exercise.sets,
                        totalVolume: this.calculateVolume(exercise.sets),
                        maxWeight: this.getMaxWeight(exercise.sets),
                        totalReps: this.getTotalReps(exercise.sets)
                    });
                }
            });
            
        return history;
    }
    
    calculateVolume(sets) {
        return sets.reduce((total, set) => 
            total + (set.weight * set.reps || 0), 0
        );
    }
    
    getMaxWeight(sets) {
        return Math.max(...sets.map(s => s.weight || 0));
    }
    
    getTotalReps(sets) {
        return sets.reduce((total, set) => total + (set.reps || 0), 0);
    }
    
    getPersonalRecord(exerciseId) {
        const history = this.getExerciseHistory(exerciseId, 100);
        if (history.length === 0) return null;
        
        return {
            maxWeight: Math.max(...history.map(h => h.maxWeight)),
            maxVolume: Math.max(...history.map(h => h.totalVolume)),
            maxReps: Math.max(...history.map(h => h.totalReps))
        };
    }
}

class SmartRestTimer {
    constructor() {
        this.restTimes = {
            strength: {
                light: '1:00',
                moderate: '2:00',
                heavy: '3:00',
                maximal: '5:00'
            },
            hypertrophy: {
                compound: '2:00',
                isolation: '1:30'
            },
            endurance: {
                default: '0:45'
            }
        };
    }
    
    suggestRestTime(exercise, set, previousSet) {
        if (!previousSet || !previousSet.weight) {
            return this.restTimes.hypertrophy.compound;
        }
        
        const intensityRatio = set.weight / previousSet.weight;
        
        if (intensityRatio >= 1.1) {
            return this.restTimes.strength.heavy;
        } else if (intensityRatio >= 0.9) {
            return this.restTimes.strength.moderate;
        } else {
            return this.restTimes.strength.light;
        }
    }
}

class WorkoutAnalytics {
    constructor(gymTracker) {
        this.app = gymTracker;
    }
    
    getWeeklyStats() {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        
        const weekWorkouts = this.app.workoutHistory.filter(w => 
            new Date(w.date) >= weekStart
        );
        
        return {
            totalWorkouts: weekWorkouts.length,
            totalDuration: weekWorkouts.reduce((sum, w) => sum + w.duration, 0),
            totalVolume: this.calculateTotalVolume(weekWorkouts),
            muscleGroups: this.getMuscleGroupDistribution(weekWorkouts),
            averageWorkoutTime: weekWorkouts.length > 0 
                ? Math.round(weekWorkouts.reduce((sum, w) => sum + w.duration, 0) / weekWorkouts.length)
                : 0
        };
    }
    
    calculateTotalVolume(workouts) {
        return workouts.reduce((total, workout) => {
            return total + workout.exercises.reduce((sum, ex) => {
                return sum + ex.sets.reduce((setSum, set) => {
                    return setSum + (set.weight * set.reps || 0);
                }, 0);
            }, 0);
        }, 0);
    }
    
    getMuscleGroupDistribution(workouts) {
        const distribution = {};
        
        workouts.forEach(workout => {
            workout.exercises.forEach(exercise => {
                const muscle = exercise.muscle || 'other';
                distribution[muscle] = (distribution[muscle] || 0) + 1;
            });
        });
        
        return distribution;
    }
    
    getProgressionData(exerciseId, weeks = 12) {
        const data = [];
        const now = new Date();
        
        for (let i = weeks - 1; i >= 0; i--) {
            const weekStart = new Date(now);
            weekStart.setDate(weekStart.getDate() - (i * 7));
            weekStart.setHours(0, 0, 0, 0);
            
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 7);
            
            const weekWorkouts = this.app.workoutHistory.filter(w => {
                const workoutDate = new Date(w.date);
                return workoutDate >= weekStart && workoutDate < weekEnd;
            });
            
            let maxWeight = 0;
            let totalVolume = 0;
            
            weekWorkouts.forEach(workout => {
                const exercise = workout.exercises.find(e => e.id === exerciseId);
                if (exercise) {
                    exercise.sets.forEach(set => {
                        maxWeight = Math.max(maxWeight, set.weight || 0);
                        totalVolume += (set.weight * set.reps || 0);
                    });
                }
            });
            
            data.push({
                week: `Week ${weeks - i}`,
                date: weekStart.toISOString(),
                maxWeight,
                totalVolume
            });
        }
        
        return data;
    }
}

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
    
    renderSuperset(exercises) {
        const supersets = this.groupBySupersetId(exercises);
        
        return Object.entries(supersets).map(([supersetId, exercises]) => {
            if (supersetId === 'null') {
                return exercises.map(ex => this.renderRegularExercise(ex)).join('');
            } else {
                return this.renderSupersetGroup(exercises);
            }
        }).join('');
    }
    
    groupBySupersetId(exercises) {
        return exercises.reduce((groups, exercise) => {
            const key = exercise.supersetId || 'null';
            groups[key] = groups[key] || [];
            groups[key].push(exercise);
            return groups;
        }, {});
    }
    
    renderSupersetGroup(exercises) {
        return `
            <div class="superset-group">
                <div class="superset-label">
                    <span class="superset-icon">⚡</span>
                    SUPERSET
                </div>
                ${exercises.map(ex => this.renderRegularExercise(ex)).join('')}
            </div>
        `;
    }
    
    renderRegularExercise(exercise) {
        return `<div class="exercise">...</div>`;
    }
}

class ExerciseLibrary {
    constructor() {
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
                icon: '/icon-192x192.png',
                badge: '/icon-192x192.png',
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

GymTracker.prototype.toggleNotifications = function() {
    const checked = document.getElementById('enable-notifications').checked;
    localStorage.setItem('gymTracker_notifications', checked ? '1' : '0');
    this.showToast(checked ? 'Đã bật thông báo nghỉ set' : 'Đã tắt thông báo nghỉ set', 'info');
}

GymTracker.prototype.togglePRNotifications = function() {
    const checked = document.getElementById('enable-pr-notifications').checked;
    localStorage.setItem('gymTracker_pr_notifications', checked ? '1' : '0');
    this.showToast(checked ? 'Đã bật thông báo PR' : 'Đã tắt thông báo PR', 'info');
}

// Initialize app
try {
    const app = new GymTracker();
    window.app = app;
    console.log('App initialized successfully');
} catch (error) {
    console.error('App initialization failed:', error);
}

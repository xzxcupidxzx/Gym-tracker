// js/app.js - Modern Gym Tracker Application

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
		this.mergeDefaultExercises();
		this.workoutHistory = this.loadData('workoutHistory') || [];
		
		// <<< ✅ CHỈ CÁC DÒNG NÀY TRONG CONSTRUCTOR
		this.supersetManager = new SupersetManager();
		this.exerciseLibrary = new ExerciseLibrary();
		this.exerciseLibrary.exercises = this.exercises;
		this.notifications = new NotificationManager();

		// Initialize
		this.init();
	}

	// ===== Initialization =====
	// ✅ ĐẶT METHOD NÀY Ở ĐÂY, NGOÀI CONSTRUCTOR:
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

    
    // ===== Initialization =====

	init() {
        this.setupEventListeners();
        this.loadPage(this.currentPage);
        this.updateStats();
        
        // Save default exercises if needed
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
				userExercises.push(defEx); // thêm mới
				added = true;
			}
		});
		if (added) this.saveData('exercises', userExercises);
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
		const notificationToggle = document.getElementById('enable-notifications');
		if (notificationToggle) {
		  // Đọc trạng thái cũ từ localStorage khi load
		  notificationToggle.checked = localStorage.getItem('gymTracker_notifications') !== '0';
		  // Gán sự kiện lưu trạng thái mới
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
            this.filterExerciseSelection(e.target.value);
        });
        
        // Filter selects
        document.getElementById('template-filter')?.addEventListener('change', (e) => {
            this.filterTemplates('', e.target.value);
        });
        
        document.getElementById('muscle-filter')?.addEventListener('change', (e) => {
            this.filterExercises('', e.target.value);
        });
    }
    
    // ===== Page Navigation =====
	loadPage(page) {
		try {
			// Update active nav
			document.querySelectorAll('.nav-link').forEach(link => {
				link.classList.toggle('active', link.dataset.page === page);
			});
			
			// Update active page
			document.querySelectorAll('.page').forEach(pageEl => {
				pageEl.classList.toggle('active', pageEl.id === `${page}-page`);
			});
			
			this.currentPage = page;
			
			// Load page content with error handling
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
					
				default:
					console.warn(`Unknown page: ${page}`);
					this.loadHomePage(); // Fallback to home
			}
			
			// Update URL hash without triggering hashchange
			if (window.location.hash !== `#${page}`) {
				history.replaceState(null, null, `#${page}`);
			}
			
		} catch (error) {
			console.error('Error loading page:', error);
			this.showToast('Lỗi tải trang, vui lòng thử lại', 'error');
		}
	}

	// ===== Analytics Page Loading (Separate Function) =====
	loadAnalyticsPage() {
		const analyticsContainer = document.querySelector('#analytics-page .analytics-grid');
		
		// Check if we have workout data
		if (this.workoutHistory.length === 0) {
			if (analyticsContainer) {
				analyticsContainer.innerHTML = `
					<div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 40px;">
						<div class="empty-icon" style="font-size: 4rem; margin-bottom: 1rem;">📊</div>
						<div class="empty-title" style="font-size: 1.5rem; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-primary);">
							Chưa có dữ liệu phân tích
						</div>
						<div class="empty-text" style="color: var(--text-secondary); margin-bottom: 1.5rem;">
							Hoàn thành một vài buổi tập để xem analytics chi tiết
						</div>
						<button class="btn btn-primary" onclick="app.startQuickWorkout()" style="margin-top: 1rem;">
							<span class="btn-icon">🚀</span>
							Bắt đầu tập ngay
						</button>
					</div>
				`;
			}
			return;
		}


	// ===== Remove Chart Loading State =====
	removeChartLoading(chartIndex) {
		const chartContainers = document.querySelectorAll('#analytics-page .chart-container');
		if (chartContainers[chartIndex]) {
			const loading = chartContainers[chartIndex].querySelector('.chart-loading');
			if (loading) {
				loading.remove();
			}
		}
	}

	// ===== Show Chart Error =====
	showChartError(chartIndex, chartName) {
		const chartContainers = document.querySelectorAll('#analytics-page .chart-container');
		if (chartContainers[chartIndex]) {
			const container = chartContainers[chartIndex];
			const loading = container.querySelector('.chart-loading');
			
			if (loading) {
				loading.innerHTML = `
					<div style="text-align: center; color: var(--text-secondary);">
						<div style="font-size: 2rem; margin-bottom: 0.5rem;">⚠️</div>
						<div>Lỗi tải ${chartName}</div>
						<button class="btn btn-sm btn-secondary" onclick="app.retryChart(${chartIndex})" style="margin-top: 0.5rem;">
							Thử lại
						</button>
					</div>
				`;
			}
		}
	}

	// ===== Show Analytics Error =====
	showAnalyticsError(message) {
		const analyticsContainer = document.querySelector('#analytics-page .analytics-grid');
		if (analyticsContainer) {
			analyticsContainer.innerHTML = `
				<div class="error-state" style="grid-column: 1 / -1; text-align: center; padding: 40px;">
					<div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
					<div style="font-size: 1.2rem; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-primary);">
						${message}
					</div>
					<button class="btn btn-primary" onclick="app.loadPage('analytics')" style="margin-top: 1rem;">
						🔄 Thử lại
					</button>
				</div>
			`;
		}
	}

	// ===== Load AI Insights =====
	loadAIInsights() {
		const insightsContainer = document.getElementById('ai-insights');
		if (!insightsContainer) return;
		
		try {
			// Generate AI insights based on workout data
			const insights = this.generateAIInsights();
			
			if (insights.length === 0) {
				insightsContainer.innerHTML = `
					<div class="insight-card" style="text-align: center; color: var(--text-secondary);">
						<div style="font-size: 1.5rem; margin-bottom: 0.5rem;">🤖</div>
						<div>Cần thêm dữ liệu để tạo insights</div>
					</div>
				`;
				return;
			}
			
			insightsContainer.innerHTML = insights.map(insight => `
				<div class="insight-card" style="padding: 1rem; background: var(--bg-secondary); border-radius: 8px; border-left: 4px solid var(--primary);">
					<div class="insight-icon" style="font-size: 1.2rem; margin-bottom: 0.5rem;">${insight.icon}</div>
					<div class="insight-title" style="font-weight: 600; margin-bottom: 0.25rem;">${insight.title}</div>
					<div class="insight-text" style="color: var(--text-secondary); font-size: 0.9rem;">${insight.text}</div>
				</div>
			`).join('');
			
		} catch (error) {
			console.error('Error loading AI insights:', error);
			insightsContainer.innerHTML = `
				<div class="insight-card" style="text-align: center; color: var(--text-secondary);">
					<div>⚠️ Lỗi tải insights</div>
				</div>
			`;
		}
	}

	// ===== Generate AI Insights =====
	generateAIInsights() {
		if (this.workoutHistory.length < 2) return [];
		
		const insights = [];
		
		try {
			// Workout frequency insight
			const weeklyFrequency = this.calculateWeeklyFrequency();
			if (weeklyFrequency < 3) {
				insights.push({
					icon: '📈',
					title: 'Tăng tần suất tập',
					text: `Bạn đang tập ${weeklyFrequency} lần/tuần. Nên tập 3-4 lần để có kết quả tối ưu.`
				});
			}
			
			// Volume progression insight
			const volumeTrend = this.calculateVolumeTrend();
			if (volumeTrend > 10) {
				insights.push({
					icon: '💪',
					title: 'Tiến bộ tuyệt vời!',
					text: `Volume tập luyện đã tăng ${volumeTrend.toFixed(1)}% so với tuần trước.`
				});
			}
			
			// Rest day insight
			const daysSinceLastWorkout = this.getDaysSinceLastWorkout();
			if (daysSinceLastWorkout > 3) {
				insights.push({
					icon: '⏰',
					title: 'Đã lâu không tập',
					text: `${daysSinceLastWorkout} ngày từ buổi tập cuối. Hãy quay lại phòng gym!`
				});
			}
			
			// Muscle group balance
			const muscleBalance = this.analyzeMuscleBalance();
			if (muscleBalance.imbalanced.length > 0) {
				insights.push({
					icon: '⚖️',
					title: 'Cân bằng nhóm cơ',
					text: `Nên tập thêm: ${muscleBalance.imbalanced.join(', ')} để cân bằng cơ thể.`
				});
			}
			
		} catch (error) {
			console.error('Error generating insights:', error);
		}
		
		return insights.slice(0, 4); // Limit to 4 insights
	}

	// ===== Helper Methods for Insights =====
	calculateWeeklyFrequency() {
		const oneWeekAgo = new Date();
		oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
		
		return this.workoutHistory.filter(w => 
			new Date(w.date) >= oneWeekAgo
		).length;
	}

	calculateVolumeTrend() {
		if (this.workoutHistory.length < 4) return 0;
		
		const recent = this.workoutHistory.slice(0, 2);
		const previous = this.workoutHistory.slice(2, 4);
		
		const recentVolume = recent.reduce((sum, w) => sum + this.calculateWorkoutVolume(w), 0);
		const previousVolume = previous.reduce((sum, w) => sum + this.calculateWorkoutVolume(w), 0);
		
		if (previousVolume === 0) return 0;
		return ((recentVolume - previousVolume) / previousVolume) * 100;
	}

	calculateWorkoutVolume(workout) {
		return workout.exercises.reduce((total, ex) => {
			return total + ex.sets.reduce((sum, set) => {
				return sum + (set.weight * set.reps || 0);
			}, 0);
		}, 0);
	}

	getDaysSinceLastWorkout() {
		if (this.workoutHistory.length === 0) return 999;
		
		const lastWorkout = new Date(this.workoutHistory[0].date);
		const now = new Date();
		return Math.floor((now - lastWorkout) / (1000 * 60 * 60 * 24));
	}

	analyzeMuscleBalance() {
		const muscleCount = {};
		const recentWorkouts = this.workoutHistory.slice(0, 4);
		
		recentWorkouts.forEach(workout => {
			workout.exercises.forEach(ex => {
				muscleCount[ex.muscle] = (muscleCount[ex.muscle] || 0) + 1;
			});
		});
		
		const avgCount = Object.values(muscleCount).reduce((sum, count) => sum + count, 0) / Object.keys(muscleCount).length;
		const imbalanced = Object.entries(muscleCount)
			.filter(([muscle, count]) => count < avgCount * 0.7)
			.map(([muscle]) => this.getMuscleName(muscle));
		
		return { muscleCount, imbalanced };
	}

	// ===== Retry Chart Function =====
	retryChart(chartIndex) {
		// Implementation for retrying specific chart
		this.showToast('Đang thử lại...', 'info');
		setTimeout(() => {
			this.renderAnalyticsCharts();
		}, 500);
	}
		// Show loading state
		this.showAnalyticsLoading();
		
		// Load analytics with delay to prevent blocking
		setTimeout(() => {
			this.renderAnalyticsCharts();
		}, 100);
	}

    // ===== Home Page =====
    loadHomePage() {
        this.renderRecentTemplates();
        this.updateStats();
    }
	// Thêm các functions này vào class GymTracker trong app.js

	// Export Templates
	exportTemplates() {
		const data = {
			templates: this.templates,
			exportDate: new Date().toISOString(),
			version: '1.0'
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
		
		this.showToast('Đã xuất danh sách templates!', 'success');
	}

	// Import Templates  
	importTemplates(event) {
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
				if (!data.templates || !Array.isArray(data.templates)) {
					this.showToast('File không hợp lệ (thiếu templates)', 'error');
					return;
				}
				
				// Ask user preference: merge or replace
				const action = confirm('Chọn OK để THAY THẾ toàn bộ, Cancel để THÊM VÀO danh sách hiện tại');
				
				if (action) {
					// Replace all templates
					this.templates = data.templates;
				} else {
					// Merge templates (avoid duplicates by name)
					const existingNames = this.templates.map(t => t.name.toLowerCase());
					const newTemplates = data.templates.filter(t => 
						!existingNames.includes(t.name.toLowerCase())
					);
					
					// Assign new IDs to avoid conflicts
					newTemplates.forEach(template => {
						template.id = this.generateId();
						template.importedAt = new Date().toISOString();
					});
					
					this.templates = [...this.templates, ...newTemplates];
					
					if (newTemplates.length === 0) {
						this.showToast('Không có template mới nào được thêm (tất cả đã tồn tại)', 'info');
						return;
					}
				}
				
				this.saveData('templates', this.templates);
				this.renderAllTemplates();
				this.showToast(`Đã import ${data.templates.length} templates thành công!`, 'success');
				
			} catch (err) {
				console.error('Import error:', err);
				this.showToast('File không hợp lệ hoặc bị lỗi!', 'error');
			}
		};
		
		reader.readAsText(file);
		
		// Reset input để có thể import lại cùng file
		event.target.value = '';
	}
    renderRecentTemplates() {
        const container = document.getElementById('recent-templates');
        const recentTemplates = this.templates.slice(0, 4);
		const cachedWorkout = this.loadData('currentWorkout');
		if (cachedWorkout && !cachedWorkout.endTime) {
			// Tìm template name
			const template = this.templates.find(t => t.id === cachedWorkout.templateId);
			const templateName = template ? template.name : 'Buổi tập chưa đặt tên';
			// Xóa banner cũ nếu có
			const oldBanner = document.getElementById('resume-workout-banner');
			if (oldBanner) oldBanner.remove();
			// Thêm mới
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
        // Calculate stats
        const totalWorkouts = this.workoutHistory.length;
        const totalTemplates = this.templates.length;
        
        // This week workouts
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        
        const thisWeekWorkouts = this.workoutHistory.filter(workout => 
            new Date(workout.date) >= weekStart
        ).length;
        
        // Total volume
        const totalVolume = this.workoutHistory.reduce((total, workout) => {
            return total + workout.exercises.reduce((sum, ex) => {
                return sum + ex.sets.reduce((setSum, set) => {
                    return setSum + (set.weight * set.reps);
                }, 0);
            }, 0);
        }, 0);
        
        // Update DOM
        document.getElementById('total-workouts').textContent = totalWorkouts;
        document.getElementById('total-templates').textContent = totalTemplates;
        document.getElementById('this-week').textContent = thisWeekWorkouts;
        document.getElementById('total-volume').textContent = Math.round(totalVolume);
    }
    
    // ===== Templates Page =====
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
		this.closeAllModals(); // Thêm dòng này!
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
    
    // ===== Exercises Page =====
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
		// Set form values
		document.getElementById('exercise-edit-name').value = exercise.name || '';
		document.getElementById('exercise-edit-muscle').value = exercise.muscle || '';
		document.getElementById('exercise-edit-type').value = exercise.type || 'strength';
		document.getElementById('exercise-edit-equipment').value = exercise.equipment || '';
		document.getElementById('exercise-edit-unit').value = exercise.unit || 'kg';
		// Show modal
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
				// Option: Gộp vào hoặc thay toàn bộ
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
	// Hàm mở modal
	
	openAddExerciseModal() {
		document.getElementById('exercise-add-form').reset();
		document.getElementById('exercise-add-modal').classList.add('active');
		// Reset chọn chip
		document.querySelectorAll('#exercise-add-muscle-group .chip-btn').forEach(btn => btn.classList.remove('selected'));
		document.getElementById('exercise-add-muscle').value = '';
		// Lắng nghe sự kiện chọn chip
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

	// Đóng modal
	closeAddExerciseModal() {
		document.getElementById('exercise-add-modal').classList.remove('active');
	}

	// Lưu bài tập mới
	saveAddExercise() {
		const name = document.getElementById('exercise-add-name').value.trim();
		const muscle = document.getElementById('exercise-add-muscle').value;
		const type = document.getElementById('exercise-add-type').value;
		const equipment = document.getElementById('exercise-add-equipment').value;
		const unit = document.getElementById('exercise-add-unit').value;

		if (!name) return this.showToast("Tên bài tập không được để trống!", "error");
		if (!muscle) return this.showToast("Vui lòng chọn nhóm cơ!", "error");

		// Kiểm tra trùng tên nếu cần
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
		// Hiện modal chỉnh sửa, hoặc prompt đơn giản để chỉnh tên/nhóm cơ
		const newName = prompt("Sửa tên bài tập:", exercise.name);
		if (newName !== null && newName.trim() !== "") {
			exercise.name = newName.trim();
			this.saveData('exercises', this.exercises);
			this.renderAllExercises();
			this.showToast("Đã cập nhật tên bài tập!", "success");
		}
		// Có thể mở rộng: thêm chỉnh nhóm cơ, loại bài, thiết bị...
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
    
    // ===== History Page =====
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
    
    // ===== Workout Functions =====
	startQuickWorkout() {
		// Check workout đang dở trong localStorage
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
		// Nếu không có workout dở, hoặc user chọn bắt đầu mới
		if (this.templates.length === 0) {
			this.showToast('Bạn cần tạo template trước!', 'warning');
			this.createTemplate();
			return;
		}
		// Start với template gần đây nhất
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
		// Ví dụ: cho phép chỉnh lại sets, notes, hoặc đơn giản chỉ alert
		alert('Bạn có thể sửa trực tiếp trong khi tập. (Có thể mở rộng UX này)');
		// Nếu muốn mở workout modal ngay luôn:
		this.resumeWorkout();
	}
// Xóa workout đang dở
	deleteResumeWorkout() {
		if (confirm("Bạn chắc chắn muốn xoá buổi tập chưa hoàn thành này?")) {
			this.saveData('currentWorkout', null);
			this.currentWorkout = null;
			// Xoá banner và render lại trang home để ẩn nút
			const banner = document.getElementById('resume-workout-banner');
			if (banner) banner.remove();
			this.showToast('Đã xoá buổi tập chưa hoàn thành.', 'success');
		}
	}
	startWorkout(templateId) {
		// 1. Check có workout đang dở không
		const cachedWorkout = this.loadData('currentWorkout');
		if (
			cachedWorkout &&
			!cachedWorkout.endTime &&
			cachedWorkout.templateId === templateId // chỉ hỏi nếu đúng template
		) {
			// Nếu có workout đang dở đúng template này thì hỏi user
			if (confirm("Bạn đang có buổi tập chưa hoàn thành. Tiếp tục không?")) {
				this.currentWorkout = cachedWorkout;
				this.showWorkoutModal(this.templates.find(t => t.id === cachedWorkout.templateId));
				this.startWorkoutTimer();
				return;
			} else {
				// User muốn bắt đầu mới => xóa trạng thái cũ
				this.saveData('currentWorkout', null);
				this.currentWorkout = null;
			}
		}

		// 2. Nếu không có workout cũ, hoặc user chọn bắt đầu mới
		const template = this.templates.find(t => t.id === templateId);
		if (!template) return;

		// 3. Tạo workout mới
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

		// 4. Lưu lại vào localStorage
		this.saveData('currentWorkout', this.currentWorkout);

		// 5. Show modal và bắt đầu timer
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
			// Unit label
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
				// Nếu muốn hiện previous, cần truyền dữ liệu cho set.previous nhé!
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

			// Rest sau set cuối + nút Add Set
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
						<div class="workout-exercise-header">
						  <span class="workout-exercise-name">${exercise.name}</span>
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

	
	// Nhấn vào rest-bar để chỉnh thời gian nghỉ
	editSetRestTime(exIndex, setIndex) {
		const timerSpan = document.getElementById(`rest-timer-${exIndex}-${setIndex}`);
		let current = timerSpan.textContent.trim();
		// Tạo input thay thế
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

		// Đặt lại bar về 100% trước khi animate
		progressBar.style.transition = 'none';
		progressBar.style.width = '100%';


		// Dọn timer cũ nếu có
		if (!this.setRestIntervals) this.setRestIntervals = {};
		Object.values(this.setRestIntervals).forEach(clearInterval);
		if (this.setRestIntervals[`${exIndex}-${setIndex}`]) {
			clearInterval(this.setRestIntervals[`${exIndex}-${setIndex}`]);
		}

		// Bắt đầu animation width 100% => 0%
		setTimeout(() => {
			progressBar.style.transition = `width ${totalTime}s linear`;
			progressBar.style.width = '0%';
		}, 50);

		// Bắt đầu countdown
		this.setRestIntervals[`${exIndex}-${setIndex}`] = setInterval(() => {
			timeLeft--;
			timerSpan.textContent = this.formatTime(timeLeft);
			if (timeLeft <= 0) {
				clearInterval(this.setRestIntervals[`${exIndex}-${setIndex}`]);
				timerSpan.textContent = "Done";
				progressBar.style.width = '0%';
			}
		}, 1000);
	}

	formatTime(seconds) {
		const m = Math.floor(seconds / 60).toString();
		const s = (seconds % 60).toString().padStart(2, "0");
		return `${m}:${s}`;
	}
	markExerciseComplete(exIndex) {
		const container = document.getElementById(`exercise-rest-${exIndex}`);
		let seconds = 60;
		const interval = setInterval(() => {
			const m = String(Math.floor(seconds / 60)).padStart(2, '0');
			const s = String(seconds % 60).padStart(2, '0');
			container.textContent = `Rest: ${m}:${s}`;
			seconds--;
			if (seconds < 0) {
				clearInterval(interval);
				container.textContent = "Done";
			}
		}, 1000);
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
		Object.values(this.setRestIntervals).forEach(clearInterval);
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
			if (timeLeft <= 0) {
				clearInterval(this.setRestIntervals[`last-${exIndex}`]);
				timerSpan.textContent = "Done";
				progressBar.style.width = '0%';
			}
		}, 1000);
	}
	skipSetRest(exIndex, setIndex) {
		// Ví dụ: Bỏ qua luôn timer, set time về 0
		document.getElementById(`rest-timer-${exIndex}-${setIndex}`).textContent = '00:00';
	}

	addSetRestTime(exIndex, setIndex, seconds) {
		// Ví dụ: Tăng thêm giây vào timer của set này
		// Bạn cần lưu biến time cho từng set, có thể gán vào exercise.sets nếu muốn.
	}
    updateSet(exIndex, setIndex, field, value) {
        this.currentWorkout.exercises[exIndex].sets[setIndex][field] = parseFloat(value) || 0;
    }
	updateSetRestTime(exIndex, setIndex, value) {
		// Cập nhật lại thời gian nghỉ cho từng set
		this.currentWorkout.exercises[exIndex].sets[setIndex].restTime = value;
	}
	addSet(exIndex) {
		// Thêm 1 set mới vào exercise
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

		// Render xong rồi mới gọi timer, tránh lỗi DOM chưa có node mới
		this.renderWorkoutExercises();

		setTimeout(() => {
			if (set.completed) {
				// Nếu là set cuối cùng -> chạy rest-bar cuối
				if (setIndex === sets.length - 1) {
					this.runRestAfterLastSetTimer(exIndex);
					const restBar = document.getElementById(`rest-bar-last-${exIndex}`);
					if (restBar) restBar.scrollIntoView({ behavior: 'smooth', block: 'center' });
				} else {
					// Nếu là set giữa -> chạy bar tiếp theo
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
	
	toggleExerciseMenu(e, exIndex) {
		e.stopPropagation();
		// Đóng tất cả menu khác trước
		document.querySelectorAll('.exercise-menu').forEach(menu => menu.style.display = 'none');
		// Toggle menu hiện tại
		const menu = document.getElementById(`exercise-menu-${exIndex}`);
		if (menu) menu.style.display = (menu.style.display === 'block' ? 'none' : 'block');
		// Click ngoài thì ẩn menu
		document.addEventListener('click', function handler(ev) {
			if (!menu.contains(ev.target)) {
				menu.style.display = 'none';
				document.removeEventListener('click', handler);
			}
		});
		document.addEventListener('click', function (e) {
			document.querySelectorAll('.exercise-menu').forEach(menu => {
				// Nếu click ra ngoài menu và ngoài nút ba chấm, thì ẩn menu
				if (!menu.contains(e.target) && !e.target.classList.contains('btn-ex-action') && !e.target.classList.contains('menu-icon')) {
					menu.style.display = 'none';
				}
			});
		});
	}
	toggleEditMenu(e, exIndex) {
		e.stopPropagation();
		// Đóng tất cả menu khác trước
		document.querySelectorAll('.exercise-menu').forEach(menu => menu.style.display = 'none');

		// Toggle menu hiện tại
		const menu = document.getElementById(`edit-menu-${exIndex}`);
		if (menu) {
			// Nếu đang ẩn thì hiện, nếu đang hiện thì ẩn
			if (menu.style.display === 'block') {
				menu.style.display = 'none';
			} else {
				menu.style.display = 'block';

				// Đóng menu khi click ra ngoài (add 1 lần, rồi remove)
				setTimeout(() => {
					function hideMenu(ev) {
						// Nếu click ngoài menu thì ẩn menu
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

	editTemplateExercise(exIndex) {
		// Ví dụ: chỉnh số set, mục tiêu rep,...
		const ex = this.selectedExercises[exIndex];
		const sets = prompt("Số set (vd: 3):", ex.sets.length);
		if (sets && !isNaN(sets) && sets > 0) {
			// Giữ giá trị rep cũ nếu có, nếu tăng thì thêm, giảm thì cắt
			while (ex.sets.length < sets) ex.sets.push({ targetReps: '8-12', restTime: '1:00' });
			while (ex.sets.length > sets) ex.sets.pop();
			this.renderSelectedExercises();
			this.showToast("Đã cập nhật số set.");
		}
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

				// Bạn nên kiểm tra dữ liệu hợp lệ (có thể tuỳ biến tuỳ file export)
				if (!data.workoutHistory || !Array.isArray(data.workoutHistory)) {
					this.showToast('File không hợp lệ (thiếu workoutHistory)', 'error');
					return;
				}

				// Import dữ liệu (thay thế hoặc merge, ở đây là thay thế hoàn toàn)
				this.workoutHistory = data.workoutHistory;
				this.saveData('workoutHistory', this.workoutHistory);

				// Nếu có import template, exercise thì cũng xử lý tương tự
				if (data.templates) {
					this.templates = data.templates;
					this.saveData('templates', this.templates);
				}
				if (data.exercises) {
					this.exercises = data.exercises;
					this.saveData('exercises', this.exercises);
				}

				this.showToast('Đã import dữ liệu thành công!', 'success');

				// Render lại UI nếu đang ở trang history
				if (this.currentPage === 'history') this.renderHistory();

			} catch (err) {
				this.showToast('File không hợp lệ hoặc bị lỗi!', 'error');
			}
		};
		reader.readAsText(file);
	}


	// Placeholder cho các chức năng
	removeExercise(exIndex) {
		if (confirm("Remove exercise này?")) {
			this.currentWorkout.exercises.splice(exIndex, 1);
			this.renderWorkoutExercises();
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
			ex.restAfterLastSet = rest; // đồng bộ cả bar cuối nếu muốn
			this.renderWorkoutExercises();
			this.showToast("Đã cập nhật thời gian nghỉ.");
		} else {
			this.showToast("Định dạng thời gian không hợp lệ.", "warning");
		}
	}
	replaceExercise(exIndex) {
		// Giả sử bạn có 1 hàm mở modal chọn bài tập (exercise picker)
		this.showExercisePicker((newExercise) => {
			// newExercise là object bài tập chọn mới
			// Có thể giữ số set cũ hoặc reset lại tuỳ logic
			this.currentWorkout.exercises[exIndex].name = newExercise.name;
			this.currentWorkout.exercises[exIndex].muscle = newExercise.muscle;
			// ... copy thuộc tính khác nếu cần
			this.renderWorkoutExercises();
			this.showToast("Đã thay thế bài tập.");
		});
	}

	// Mockup cho showExercisePicker (tuỳ bạn làm modal hay popup):
	showExercisePicker(callback) {
		// Dùng modal riêng cho replace hoặc tái sử dụng modal chọn bài tập (nên làm riêng nếu flow khác nhau)
		const modal = document.getElementById('exercise-picker-modal');
		const list = document.getElementById('exercise-picker-list');
		let selectedId = null;

		// Render danh sách bài tập
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

		// Chức năng chọn 1 bài duy nhất
		window.app.selectReplaceExercise = function(id, el) {
			document.querySelectorAll('#exercise-picker-list .exercise-select-item').forEach(item => item.classList.remove('selected'));
			el.classList.add('selected');
			selectedId = id;
		};

		// Xác nhận chọn
		document.getElementById('confirm-ex-picker-btn').onclick = () => {
			if (!selectedId) {
				app.showToast("Vui lòng chọn 1 bài tập để thay thế!", "warning");
				return;
			}
			const selectedEx = app.exercises.find(e => e.id === selectedId);
			if (selectedEx) callback(selectedEx);
			modal.classList.remove('active');
		};

		// Mở modal
		modal.classList.add('active');
	}
	closeExercisePicker() {
		document.getElementById('exercise-picker-modal').classList.remove('active');
	}

	createSuperset(exIndex) {
		// Giả sử bạn show popup chọn bài tập khác
		this.showExercisePicker((otherExercise) => {
			// Đánh dấu 2 bài này thuộc cùng superset (ví dụ supersetId = random id)
			const supersetId = Date.now() + '-' + Math.random().toString(36).substr(2,5);
			this.currentWorkout.exercises[exIndex].supersetId = supersetId;
			// tìm index bài vừa chọn, đánh dấu supersetId giống
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

		// Render menu
		const menu = document.getElementById('unit-context-menu');
		menu.innerHTML = unitOptions.map(u =>
			`<button class="context-menu-btn${u===currentUnit?' selected':''}" data-unit="${u}">${u.toUpperCase()}</button>`
		).join('');

		// Hiện menu tại vị trí nút hoặc chuột
		let x = event ? event.clientX : window.innerWidth/2, y = event ? event.clientY : window.innerHeight/2;
		menu.style.left = x + 'px';
		menu.style.top = y + 'px';
		menu.style.display = 'flex';

		// Chọn đơn vị
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

		// Đóng menu khi click ngoài
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

		// Xóa workout dở dang
		this.saveData('currentWorkout', null);
		this.currentWorkout = null;

		this.closeWorkout();
		this.showToast('Workout đã được lưu! 💪', 'success');
		this.updateStats();

		// **THÊM DÒNG SAU ĐỂ CẬP NHẬT UI**
		// ✅ BẰNG dòng đơn giản này:
		this.loadPage(this.currentPage);
		document.getElementById('resume-workout-banner')?.remove();
	}
	

    
	closeWorkout() {
		clearInterval(this.workoutTimer);
		
		// ✅ THÊM đoạn này:
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

    
    // ===== Template Management =====
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
            // Update existing
            const index = this.templates.findIndex(t => t.id === template.id);
            this.templates[index] = template;
        } else {
            // Create new
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
        const searchTerm = search.toLowerCase();
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
            
            // Sửa HTML để giống với renderExerciseSelection cho việc chọn/bỏ chọn
            return `
                <div class="exercise-select-item ${isSelected ? 'selected' : ''}" 
                     onclick="app.toggleExerciseSelection('${exercise.id}')">
                    <input type="checkbox" 
                           class="exercise-checkbox" 
                           ${isSelected ? 'checked' : ''} 
                           readonly> {/* readonly để click chỉ xử lý qua div cha */}
                    <div class="exercise-info">
                        <div class="exercise-icon">${this.getMuscleIcon(exercise.muscle)}</div>
                        <div>
                            <div style="color: var(--text-primary);">${exercise.name}</div>
                            <div class="text-muted">${this.getMuscleName(exercise.muscle)}</div>
                        </div>
                    </div>
                    {/* Không cần nút "Tập" hay "Sửa" ở đây vì đây là modal chọn bài cho template */}
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
				sets: [
					{ targetReps: '8-12', restTime: '1:00', completed: false },
					{ targetReps: '8-12', restTime: '1:00', completed: false },
					{ targetReps: '8-12', restTime: '1:00', completed: false }
				]
			});
        }
        
        this.renderExerciseSelection();
    }
    
    confirmExerciseSelection() {
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
			// Xác định đơn vị
			const unitLabel = exercise.unit === 'lb' ? 'lb'
							: exercise.unit === 'minute' ? 'Min'
							: exercise.unit === 'second' ? 'Sec'
							: 'kg';
			const repsLabel = exercise.unit === 'minute' ? 'Minute'
							: exercise.unit === 'second' ? 'Second'
							: 'Reps';

			// Note và sticky note
			let noteHtml = '';
			if (exercise.note) noteHtml += `<div class="exercise-note" style="color:var(--primary);font-size:0.93em;margin:7px 0 3px 0;">📝 ${exercise.note}</div>`;
			if (exercise.stickyNote) noteHtml += `<div class="exercise-sticky-note" style="color:#FFEB3B;font-weight:bold;margin:0 0 5px 0;">📌 ${exercise.stickyNote}</div>`;

			// Table sets
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
				<div class="add-set-row" style="text-align:right; margin-top:6px;">
					<button class="btn btn-primary btn-sm" onclick="app.addTemplateSet(${exIndex})">+ Add Set</button>
				</div>
			`;

			// Giao diện bài tập (header fix chuẩn)
			return `
			<div class="workout-exercise" style="background:var(--bg-tertiary);border-radius:14px;margin-bottom:18px;">
				<div class="workout-exercise-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
					<span class="workout-exercise-name" style="font-size:1.13em;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;display:inline-block;">${exercise.name}</span>
					<div class="exercise-actions" style="display:flex;align-items:center;position:relative;">
						<button class="btn-ex-action" onclick="app.toggleEditMenu(event, ${exIndex})" title="Tùy chọn">
							<span class="menu-icon">⋯</span>
						</button>
						<div class="exercise-menu" id="edit-menu-${exIndex}" style="display:none;z-index:1051;right:0;top:36px;position:absolute;">
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
				${noteHtml}
				<div class="sets-table">${setsHtml}</div>
			</div>
			`;
		}).join('');
	}


	updateTemplateSetField(exIndex, setIndex, field, value) {
		// Nếu là targetWeight, ép về số
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

    updateTemplateSet(exIndex, setIndex, value) {
        this.selectedExercises[exIndex].sets[setIndex].targetReps = value;
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
		// Gọi popup chọn bài tập mới, update name/muscle, giữ lại các set nếu muốn
		this.showExercisePicker((newExercise) => {
			this.selectedExercises[exIndex].name = newExercise.name;
			this.selectedExercises[exIndex].muscle = newExercise.muscle;
			// có thể update unit, sets...
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
		// Tùy chỉnh giống workout
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
    // ===== Rest Timer =====
    startRestTimer(seconds = 120) {
        const restTimerEl = document.getElementById('rest-timer');
        const restTimeEl = document.getElementById('rest-time');
        
        restTimerEl.classList.add('active');
        
        let timeLeft = seconds;
        
        this.restTimer = setInterval(() => {
            timeLeft--;
            const minutes = Math.floor(timeLeft / 60);
            const secs = timeLeft % 60;
            
            restTimeEl.textContent = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            
            if (timeLeft <= 0) {
                this.skipRest();
                // Play sound or vibrate
                if (navigator.vibrate) {
                    navigator.vibrate([200, 100, 200]);
                }
            }
        }, 1000);
    }
    
    skipRest() {
        clearInterval(this.restTimer);
        document.getElementById('rest-timer').classList.remove('active');
    }
    
    addRestTime(seconds) {
        // TODO: Implement add time to rest timer
        this.showToast(`+${seconds}s`, 'info');
    }
    
    // ===== Data Management =====
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
    
    // ===== Utilities =====
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
previewWorkout(exerciseId) {
    this.showToast("Xem trước bài tập đơn chưa được triển khai", "info");
}

editExercise(exerciseId) {
    this.showToast("Chức năng sửa bài tập đang phát triển", "info");
}
    // ===== Default Data =====
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
// Additional features and improvements for Gym Tracker

// ===== 1. Auto-save workout progress =====
class AutoSaveManager {
    constructor(gymTracker) {
        this.app = gymTracker;
        this.saveInterval = null;
        this.startAutoSave();
    }
    
    startAutoSave() {
        // Auto-save every 30 seconds
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

// ===== 2. Exercise History Tracking =====
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

// ===== 3. Smart Rest Timer =====
class SmartRestTimer {
    constructor() {
        this.restTimes = {
            strength: {
                light: '1:00',      // < 60% 1RM
                moderate: '2:00',   // 60-80% 1RM
                heavy: '3:00',      // 80-90% 1RM
                maximal: '5:00'     // > 90% 1RM
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
        // Calculate intensity based on previous set
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

// ===== 4. Workout Analytics =====
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

// ===== 5. Superset Support =====
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
                // Regular exercises
                return exercises.map(ex => this.renderRegularExercise(ex)).join('');
            } else {
                // Superset group
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
        // Regular exercise rendering
        return `<div class="exercise">...</div>`;
    }
}

// ===== 6. Exercise Library Enhancement =====
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
        
        // Search logic with filters
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
        
        // Sort by relevance
        return results.sort((a, b) => b.relevance - a.relevance);
    }
    
    calculateRelevance(exercise, searchTerm) {
        let score = 0;
        
        // Exact match
        if (exercise.name.toLowerCase() === searchTerm) score += 10;
        
        // Starts with search term
        if (exercise.name.toLowerCase().startsWith(searchTerm)) score += 5;
        
        // Contains search term
        if (exercise.name.toLowerCase().includes(searchTerm)) score += 3;
        
        // Popular exercise
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

// ===== 7. Notification System =====
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
            
            // Auto close after 5 seconds
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
	// ===== AI Features (Placeholder) =====

	acceptAISuggestion() {
		document.getElementById('ai-suggestion-banner').style.display = 'none';
		this.showToast('Đã chấp nhận gợi ý AI! 🤖✅', 'success');
	}

	// Settings functions
	openSettings() {
		document.getElementById('settings-modal').classList.add('active');
	}

	closeSettings() {
		document.getElementById('settings-modal').classList.remove('active');
	}

	openBackendSettings() {
		document.getElementById('backend-settings-modal').classList.add('active');
	}

	closeBackendSettings() {
		document.getElementById('backend-settings-modal').classList.remove('active');
	}

	// Placeholder settings functions
	setWeightUnit(unit) {
		localStorage.setItem('gymTracker_weightUnit', unit);
		this.showToast(`Đã đổi đơn vị sang ${unit.toUpperCase()}`, 'info');
	}

	setTheme(theme) {
		localStorage.setItem('gymTracker_theme', theme);
		this.showToast(`Đã đổi theme sang ${theme}`, 'info');
	}

	toggleAISuggestions() {
		const checked = document.getElementById('enable-ai-suggestions').checked;
		localStorage.setItem('gymTracker_aiSuggestions', checked ? '1' : '0');
	}

	toggleFormChecks() {
		const checked = document.getElementById('enable-form-checks').checked;
		localStorage.setItem('gymTracker_formChecks', checked ? '1' : '0');
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
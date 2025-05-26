// analytics.js - Advanced Analytics with Chart.js (Fixed & Improved)

class AdvancedAnalytics {
    constructor(app) {
        this.app = app;
        this.charts = {};
        this.colors = {
            primary: '#4CAF50',
            secondary: '#2196F3', 
            warning: '#FFC107',
            danger: '#F44336',
            info: '#00BCD4',
            success: '#8BC34A',
            purple: '#9C27B0',
            orange: '#FF9800'
        };
        this.colorArray = Object.values(this.colors);
    }

    // ===== Helper: Kiểm tra Chart.js =====
    ensureChartJs() {
        if (!window.Chart) {
            console.error("Chart.js not loaded!");
            this.showError("Chart.js library is required for analytics");
            return false;
        }
        return true;
    }

    // ===== Volume Progression Chart =====
    createVolumeChart(containerId, exerciseId = null) {
        if (!this.ensureChartJs()) return;
        
        const canvas = document.getElementById(containerId);
        if (!canvas) return this.showNoCanvas(containerId, "Volume Chart");

        const { labels, values, exerciseName } = this.getVolumeData(exerciseId);

        if (values.length === 0 || values.every(v => v === 0)) {
            return this.showNoData(canvas, "Không có dữ liệu volume để hiển thị.");
        }

        // Destroy existing chart
        if (this.charts.volume) {
            this.charts.volume.destroy();
        }

        this.charts.volume = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: exerciseId ? `Volume - ${exerciseName}` : 'Tổng Volume (kg)',
                    data: values,
                    borderColor: this.colors.primary,
                    backgroundColor: this.colors.primary + '22',
                    tension: 0.3,
                    fill: true,
                    pointBackgroundColor: this.colors.primary,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { 
                        display: true, 
                        text: exerciseId ? `Tiến trình Volume - ${exerciseName}` : 'Tiến trình Volume Tổng',
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        callbacks: {
                            label: (ctx) => `Volume: ${ctx.parsed.y.toLocaleString()} kg`
                        }
                    }
                },
                scales: {
                    x: { 
                        title: { display: true, text: 'Thời gian' },
                        grid: { color: 'rgba(0,0,0,0.1)' }
                    },
                    y: { 
                        beginAtZero: true, 
                        title: { display: true, text: 'Volume (kg)' },
                        grid: { color: 'rgba(0,0,0,0.1)' },
                        ticks: {
                            callback: function(value) {
                                return value.toLocaleString() + ' kg';
                            }
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    }

    // ===== Muscle Distribution Chart =====
    createMuscleDistributionChart(containerId) {
        if (!this.ensureChartJs()) return;
        
        const canvas = document.getElementById(containerId);
        if (!canvas) return this.showNoCanvas(containerId, "Muscle Distribution");

        const { labels, values } = this.getMuscleDistributionData();

        if (!labels.length || values.every(v => v === 0)) {
            return this.showNoData(canvas, "Không có dữ liệu nhóm cơ để hiển thị.");
        }

        if (this.charts.muscle) {
            this.charts.muscle.destroy();
        }

        this.charts.muscle = new Chart(canvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: this.colorArray.slice(0, labels.length),
                    borderColor: '#fff',
                    borderWidth: 2,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { 
                        display: true, 
                        text: 'Phân bổ nhóm cơ',
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: { 
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        callbacks: {
                            label: (ctx) => {
                                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((ctx.parsed * 100) / total).toFixed(1);
                                return `${ctx.label}: ${ctx.parsed} buổi (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // ===== Workout Frequency Chart (Thay thế Heatmap) =====
    createWorkoutFrequencyChart(containerId) {
        if (!this.ensureChartJs()) return;
        
        const canvas = document.getElementById(containerId);
        if (!canvas) return this.showNoCanvas(containerId, "Workout Frequency");

        const { labels, values } = this.getWorkoutFrequencyData();

        if (!labels.length || values.every(v => v === 0)) {
            return this.showNoData(canvas, "Không có dữ liệu tần suất tập luyện.");
        }

        if (this.charts.frequency) {
            this.charts.frequency.destroy();
        }

        this.charts.frequency = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Số buổi tập',
                    data: values,
                    backgroundColor: this.colors.info + '88',
                    borderColor: this.colors.info,
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { 
                        display: true, 
                        text: 'Tần suất tập luyện theo ngày trong tuần',
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        callbacks: {
                            label: (ctx) => `${ctx.parsed.y} buổi tập`
                        }
                    }
                },
                scales: {
                    x: { 
                        title: { display: true, text: 'Ngày trong tuần' },
                        grid: { display: false }
                    },
                    y: { 
                        beginAtZero: true, 
                        title: { display: true, text: 'Số buổi tập' },
                        ticks: { stepSize: 1 }
                    }
                }
            }
        });
    }

    // ===== Personal Records Timeline Chart =====
    createPRTimeline(containerId) {
        if (!this.ensureChartJs()) return;
        
        const canvas = document.getElementById(containerId);
        if (!canvas) return this.showNoCanvas(containerId, "PR Timeline");

        const { datasets } = this.getPRTimelineData();

        if (!datasets.length) {
            return this.showNoData(canvas, "Chưa có Personal Records để hiển thị.");
        }

        if (this.charts.pr) {
            this.charts.pr.destroy();
        }

        this.charts.pr = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { 
                        display: true, 
                        text: 'Personal Records Timeline',
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: { 
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 15
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        callbacks: {
                            label: (ctx) => {
                                const point = ctx.raw;
                                const date = new Date(point.x).toLocaleDateString('vi-VN');
                                return `${ctx.dataset.label}: ${point.y}kg (${date})`;
                            }
                        }
                    }
                },
                scales: {
                    x: { 
                        type: 'linear',
                        title: { display: true, text: 'Workout Number' }
                    },
                    y: { 
                        beginAtZero: false, 
                        title: { display: true, text: 'Weight (kg)' },
                        ticks: {
                            callback: function(value) {
                                return value + ' kg';
                            }
                        }
                    }
                },
                elements: {
                    point: { radius: 5, hoverRadius: 7 },
                    line: { tension: 0.2 }
                }
            }
        });
    }

    // ===== Strength Standards Radar Chart =====
    createStrengthStandardsChart(containerId) {
        if (!this.ensureChartJs()) return;
        
        const canvas = document.getElementById(containerId);
        if (!canvas) return this.showNoCanvas(containerId, "Strength Standards");

        const { labels, current, targets, maxValue } = this.getStrengthStandardsData();
        
        if (!labels.length || current.every(v => !v)) {
            return this.showNoData(canvas, "Không có dữ liệu sức mạnh để hiển thị.");
        }

        if (this.charts.strength) {
            this.charts.strength.destroy();
        }

        this.charts.strength = new Chart(canvas.getContext('2d'), {
            type: 'radar',
            data: {
                labels,
                datasets: [
                    {
                        label: '1RM Hiện tại',
                        data: current,
                        borderColor: this.colors.primary,
                        backgroundColor: this.colors.primary + '44',
                        pointBackgroundColor: this.colors.primary,
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2
                    },
                    {
                        label: 'Mục tiêu',
                        data: targets,
                        borderColor: this.colors.warning,
                        backgroundColor: this.colors.warning + '22',
                        pointBackgroundColor: this.colors.warning,
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        borderDash: [5, 5]
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { 
                        display: true, 
                        text: 'So sánh sức mạnh (1RM ước tính)',
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: {
                        position: 'top',
                        labels: { usePointStyle: true }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        callbacks: {
                            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.r} kg`
                        }
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        suggestedMax: maxValue,
                        ticks: { 
                            stepSize: Math.ceil(maxValue / 5),
                            callback: (v) => v + ' kg'
                        },
                        grid: { color: 'rgba(0,0,0,0.1)' },
                        angleLines: { color: 'rgba(0,0,0,0.1)' }
                    }
                },
                elements: {
                    line: { borderWidth: 2 },
                    point: { radius: 4, hoverRadius: 6 }
                }
            }
        });
    }

    // ===== Prediction Chart (New) =====
    createPredictionChart(containerId) {
        if (!this.ensureChartJs()) return;
        
        const canvas = document.getElementById(containerId);
        if (!canvas) return this.showNoCanvas(containerId, "Progress Prediction");

        const { datasets } = this.getPredictionData();

        if (!datasets.length) {
            return this.showNoData(canvas, "Không đủ dữ liệu để dự đoán tiến trình.");
        }

        if (this.charts.prediction) {
            this.charts.prediction.destroy();
        }

        this.charts.prediction = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { 
                        display: true, 
                        text: 'Dự đoán tiến trình (6 tuần tới)',
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: { 
                        position: 'top',
                        labels: { usePointStyle: true }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        callbacks: {
                            label: (ctx) => {
                                const point = ctx.raw;
                                const date = new Date(point.x).toLocaleDateString('vi-VN');
                                const prediction = ctx.dataset.label.includes('Dự đoán') ? ' (dự đoán)' : '';
                                return `${ctx.dataset.label}: ${point.y}kg${prediction}`;
                            }
                        }
                    }
                },
                scales: {
                    x: { 
                        type: 'linear',
                        title: { display: true, text: 'Week Number' }
                    },
                    y: { 
                        beginAtZero: false, 
                        title: { display: true, text: 'Weight (kg)' }
                    }
                }
            }
        });
    }

    // ========== Helper Methods ==========

    showNoCanvas(containerId, name) {
        console.warn(`Canvas with ID '${containerId}' not found for ${name}`);
        const container = document.getElementById(containerId)?.parentElement;
        if (container) {
            container.innerHTML = `<div style="text-align:center;padding:40px;color:#666;">Canvas "${containerId}" not found</div>`;
        }
    }

    showNoData(canvas, message) {
        if (canvas && canvas.parentElement) {
            canvas.parentElement.innerHTML = `
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;color:#666;min-height:200px;">
                    <div style="font-size:3em;margin-bottom:16px;">📊</div>
                    <div style="font-size:1.1em;font-weight:500;margin-bottom:8px;">Chưa có dữ liệu</div>
                    <div style="font-size:0.9em;">${message}</div>
                </div>
            `;
        }
    }

    showError(message) {
        console.error('Analytics Error:', message);
        // Could show toast notification here if available
        if (this.app && this.app.showToast) {
            this.app.showToast(`Analytics: ${message}`, 'error');
        }
    }

    // ========== Data Processing Methods ==========

    getVolumeData(exerciseId = null) {
        const weeks = 12;
        const labels = [];
        const values = [];
        let exerciseName = '';

        if (exerciseId) {
            const exercise = this.app.exercises.find(ex => ex.id === exerciseId);
            exerciseName = exercise ? exercise.name : 'Unknown Exercise';
        }

        for (let i = weeks - 1; i >= 0; i--) {
            const weekStart = new Date();
            weekStart.setDate(weekStart.getDate() - (i * 7) - weekStart.getDay());
            weekStart.setHours(0, 0, 0, 0);
            
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);

            const weekWorkouts = this.app.workoutHistory.filter(w => {
                const date = new Date(w.date);
                return date >= weekStart && date <= weekEnd;
            });

            let volume = 0;
            weekWorkouts.forEach(workout => {
                workout.exercises.forEach(ex => {
                    if (!exerciseId || ex.id === exerciseId) {
                        volume += ex.sets.reduce((sum, set) => {
                            return sum + ((set.weight || 0) * (set.reps || 0));
                        }, 0);
                    }
                });
            });

            labels.push(`Tuần ${weeks - i}`);
            values.push(Math.round(volume));
        }

        return { labels, values, exerciseName };
    }

    getMuscleDistributionData() {
        const distribution = {};
        const workoutCount = {};

        this.app.workoutHistory.forEach(workout => {
            const musclesInWorkout = new Set();
            
            workout.exercises.forEach(ex => {
                const muscleName = this.app.getMuscleName(ex.muscle) || 'Khác';
                musclesInWorkout.add(muscleName);
            });

            musclesInWorkout.forEach(muscle => {
                workoutCount[muscle] = (workoutCount[muscle] || 0) + 1;
            });
        });

        return {
            labels: Object.keys(workoutCount),
            values: Object.values(workoutCount)
        };
    }

    getWorkoutFrequencyData() {
        const dayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
        const frequency = new Array(7).fill(0);

        this.app.workoutHistory.forEach(workout => {
            const dayOfWeek = new Date(workout.date).getDay();
            frequency[dayOfWeek]++;
        });

        return {
            labels: dayNames,
            values: frequency
        };
    }

    getPRTimelineData() {
        // Get all exercises that have weight data
        const exercisesWithData = this.app.exercises.filter(ex => 
            this.app.workoutHistory.some(w => 
                w.exercises.some(we => we.id === ex.id && 
                    we.sets.some(set => set.weight > 0)
                )
            )
        );

        const datasets = [];
        const colors = this.colorArray;

        exercisesWithData.slice(0, 6).forEach((exercise, idx) => {
            const prs = [];
            let maxWeight = 0;

            this.app.workoutHistory
                .sort((a, b) => new Date(a.date) - new Date(b.date))
                .forEach(workout => {
                    const ex = workout.exercises.find(e => e.id === exercise.id);
                    if (ex) {
                        const maxSet = ex.sets.reduce((max, set) => 
                            (set.weight || 0) > (max.weight || 0) ? set : max, 
                            { weight: 0, reps: 0 }
                        );

                        if (maxSet.weight > maxWeight) {
                            maxWeight = maxSet.weight;
                            prs.push({
                                x: new Date(workout.date).valueOf(),
                                y: maxSet.weight
                            });
                        }
                    }
                });

            if (prs.length > 0) {
                datasets.push({
                    label: exercise.name,
                    data: prs,
                    borderColor: colors[idx % colors.length],
                    backgroundColor: colors[idx % colors.length] + '44',
                    tension: 0.2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                });
            }
        });

        return { datasets };
    }

    getStrengthStandardsData() {
        const bodyweight = parseFloat(localStorage.getItem('userBodyweight')) || 75;
        const standards = [
            { name: 'Bench Press', target: 1.5 },
            { name: 'Squat', target: 2.0 },
            { name: 'Deadlift', target: 2.5 },
            { name: 'Overhead Press', target: 1.0 }
        ];

        const labels = [];
        const current = [];
        const targets = [];
        let maxValue = 0;

        standards.forEach(std => {
            const exercise = this.app.exercises.find(e => 
                e.name.toLowerCase().includes(std.name.toLowerCase()) ||
                std.name.toLowerCase().includes(e.name.toLowerCase())
            );

            if (exercise) {
                labels.push(std.name);
                
                let max1RM = 0;
                this.app.workoutHistory.forEach(workout => {
                    const ex = workout.exercises.find(e => e.id === exercise.id);
                    if (ex) {
                        ex.sets.forEach(set => {
                            if (set.weight > 0 && set.reps > 0) {
                                // Epley formula for 1RM estimation
                                const est1RM = set.weight * (1 + set.reps / 30);
                                if (est1RM > max1RM) max1RM = est1RM;
                            }
                        });
                    }
                });

                const targetWeight = bodyweight * std.target;
                current.push(Math.round(max1RM));
                targets.push(Math.round(targetWeight));
                maxValue = Math.max(maxValue, max1RM, targetWeight);
            }
        });

        return {
            labels,
            current,
            targets,
            maxValue: Math.ceil((maxValue * 1.2) / 10) * 10 // Round up to nearest 10
        };
    }

    getPredictionData() {
        // Simple linear regression prediction for volume progression
        const volumeData = this.getVolumeData();
        const datasets = [];

        if (volumeData.values.length < 4) {
            return { datasets: [] };
        }

        // Calculate trend
        const n = volumeData.values.length;
        const sumX = (n * (n - 1)) / 2;
        const sumY = volumeData.values.reduce((a, b) => a + b, 0);
        const sumXY = volumeData.values.reduce((sum, y, x) => sum + x * y, 0);
        const sumX2 = volumeData.values.reduce((sum, _, x) => sum + x * x, 0);

        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        // Historical data
        const historicalData = volumeData.values.map((value, index) => ({
            x: new Date(Date.now() - (n - 1 - index) * 7 * 24 * 60 * 60 * 1000).valueOf(),
            y: value
        }));

        // Prediction data (next 6 weeks)
        const predictionData = [];
        for (let i = 1; i <= 6; i++) {
            const futureDate = new Date(Date.now() + i * 7 * 24 * 60 * 60 * 1000);
            const predictedValue = Math.max(0, intercept + slope * (n + i - 1));
            predictionData.push({
                x: futureDate.valueOf(),
                y: Math.round(predictedValue)
            });
        }

        datasets.push(
            {
                label: 'Volume thực tế',
                data: historicalData,
                borderColor: this.colors.primary,
                backgroundColor: this.colors.primary + '44',
                tension: 0.3
            },
            {
                label: 'Dự đoán volume',
                data: predictionData,
                borderColor: this.colors.warning,
                backgroundColor: this.colors.warning + '44',
                borderDash: [5, 5],
                tension: 0.3
            }
        );

        return { datasets };
    }

    // ===== Destroy all charts =====
    destroyAllCharts() {
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        this.charts = {};
    }
}

// Export class for app.js usage
window.AdvancedAnalytics = AdvancedAnalytics;
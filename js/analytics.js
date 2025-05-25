// analytics.js - Advanced Analytics with Chart.js (Tối ưu cho Gym Tracker)

class AdvancedAnalytics {
    constructor(app) {
        this.app = app;
        this.charts = {};
    }

    // ===== Helper: Kiểm tra Chart.js =====
	 ensureChartJs() {
		if (!window.Chart) {
			console.error("Chart.js not loaded!");
			return false;
		}
		return true;
	}

    // ===== Volume Progression Chart =====
    createVolumeChart(containerId, exerciseId = null) {
        this.ensureChartJs();
        const canvas = document.getElementById(containerId);
        if (!canvas) return this.showNoCanvas(containerId, "Volume Chart");

        const { labels, values } = this.getVolumeData(exerciseId);

        if (values.every(v => v === 0)) {
            return this.showNoData(canvas, "Không có dữ liệu volume.");
        }

        if (this.charts.volume) this.charts.volume.destroy();

        this.charts.volume = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: exerciseId ? 'Volume ' + (this.app.exercises.find(ex => ex.id === exerciseId)?.name || "") : 'Tổng Volume (kg)',
                    data: values,
                    borderColor: '#4CAF50',
                    backgroundColor: '#4CAF5022',
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: { display: true, text: 'Tiến trình Volume' },
                    tooltip: {
                        callbacks: {
                            label: ctx => `Volume: ${ctx.parsed.y.toLocaleString()} kg`
                        }
                    }
                },
                scales: {
                    x: { title: { display: true, text: 'Tuần' } },
                    y: { beginAtZero: true, title: { display: true, text: 'Volume (kg)' } }
                }
            }
        });
    }

    // ===== Muscle Distribution Chart =====
    createMuscleDistributionChart(containerId) {
        this.ensureChartJs();
        const canvas = document.getElementById(containerId);
        if (!canvas) return this.showNoCanvas(containerId, "Muscle Distribution");

        const { labels, values } = this.getMuscleDistributionData();

        if (!labels.length) return this.showNoData(canvas, "Không có dữ liệu nhóm cơ.");

        if (this.charts.muscle) this.charts.muscle.destroy();

        const colorArr = [
            '#4CAF50', '#2196F3', '#FFC107', '#FF5722', '#9C27B0', '#00BCD4',
            '#607D8B', '#E91E63', '#8BC34A', '#FF9800'
        ];

        this.charts.muscle = new Chart(canvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: colorArr,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: { display: true, text: 'Phân bổ nhóm cơ' },
                    legend: { position: 'bottom' }
                }
            }
        });
    }

    // ===== Heatmap Chart (Yêu cầu chartjs-chart-matrix plugin) =====
    createWorkoutHeatmap(containerId) {
        this.ensureChartJs();
        if (!Chart.registry || !Chart.registry.getChart || !Chart.registry.getChart('matrix')) {
            // Plugin chưa load
            const canvas = document.getElementById(containerId);
            if (canvas) canvas.parentElement.innerHTML = "<p style='text-align:center;padding:30px'>Cần thêm plugin chartjs-chart-matrix để hiện heatmap.</p>";
            return;
        }

        const canvas = document.getElementById(containerId);
        if (!canvas) return this.showNoCanvas(containerId, "Workout Heatmap");

        const heatmapData = this.getHeatmapData();
        if (!heatmapData.length) return this.showNoData(canvas, "Không có dữ liệu heatmap.");

        if (this.charts.heatmap) this.charts.heatmap.destroy();

        this.charts.heatmap = new Chart(canvas.getContext('2d'), {
            type: 'matrix',
            data: { datasets: [{
                label: 'Tần suất Workout',
                data: heatmapData,
                backgroundColor: ctx => {
                    const v = ctx.dataset.data[ctx.dataIndex].v;
                    if (!v) return '#21212133'; // ngày không tập
                    const base = [76, 175, 80]; // #4CAF50
                    const alpha = Math.min(0.15 + v * 0.28, 1);
                    return `rgba(${base.join(',')},${alpha})`;
                },
                borderColor: '#2a2a2a',
                borderWidth: 1,
                width: ({chart}) => ((chart.chartArea?.width || 364) / 52) - 2,
                height: ({chart}) => ((chart.chartArea?.height || 196) / 7) - 2
            }]},
            options: {
                responsive: true,
                plugins: {
                    title: { display: true, text: 'Heatmap Workout (52 tuần)' },
                    tooltip: {
                        callbacks: {
                            label: ctx => {
                                const d = ctx.raw;
                                return `${d.date}: ${d.v} buổi`;
                            }
                        }
                    },
                    legend: { display: false }
                },
                scales: {
                    x: { type: 'category', labels: Array.from({length: 52}, (_,i)=>`W${i+1}`), grid: {display: false}},
                    y: { type: 'category', labels: ['CN','T7','T6','T5','T4','T3','T2'], grid: {display: false}}
                }
            }
        });
    }

    // ===== Personal Records Timeline Chart =====
    createPRTimeline(containerId) {
        this.ensureChartJs();
        const canvas = document.getElementById(containerId);
        if (!canvas) return this.showNoCanvas(containerId, "PR Timeline");

        const { datasets } = this.getPRTimelineData();

        if (!datasets.length) return this.showNoData(canvas, "Chưa có Personal Records nào.");

        if (this.charts.pr) this.charts.pr.destroy();

        this.charts.pr = new Chart(canvas.getContext('2d'), {
            type: 'scatter',
            data: { datasets },
            options: {
                responsive: true,
                plugins: {
                    title: { display: true, text: 'Personal Records Timeline' },
                    tooltip: {
                        callbacks: {
                            label: ctx => {
                                const pr = ctx.raw;
                                return `${pr.exercise}: ${pr.y}kg x ${pr.reps} (${new Date(pr.x).toLocaleDateString()})`;
                            }
                        }
                    }
                },
                scales: {
                    x: { type: 'time', time: { unit: 'week' }, title: {display:true, text:'Ngày'} },
                    y: { beginAtZero: false, title: {display:true, text:'Weight (kg)'} }
                }
            }
        });
    }

    // ===== Strength Standards Radar Chart =====
    createStrengthStandardsChart(containerId) {
        this.ensureChartJs();
        const canvas = document.getElementById(containerId);
        if (!canvas) return this.showNoCanvas(containerId, "Strength Standards");

        const { labels, current, suggestedMax } = this.getStrengthStandardsData();
        if (!labels.length || current.every(v=>!v)) return this.showNoData(canvas, "Không có dữ liệu sức mạnh.");

        if (this.charts.strength) this.charts.strength.destroy();

        this.charts.strength = new Chart(canvas.getContext('2d'), {
            type: 'radar',
            data: {
                labels,
                datasets: [{
                    label: '1RM Ước tính',
                    data: current,
                    borderColor: '#4CAF50',
                    backgroundColor: '#4CAF5044',
                    pointBackgroundColor: '#4CAF50'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: { display: true, text: 'So sánh sức mạnh (1RM)' }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        suggestedMax,
                        ticks: { callback: v => v + ' kg' }
                    }
                },
                elements: {
                    line: { borderWidth: 2 },
                    point: { radius: 3 }
                }
            }
        });
    }

    // ========== Helper ==========

    showNoCanvas(containerId, name) {
        console.warn(`Canvas with ID ${containerId} không tồn tại (${name})`);
    }
    showNoData(canvas, msg) {
        if (canvas && canvas.parentElement) {
            canvas.parentElement.innerHTML = `<div style="text-align:center;opacity:.6;padding:40px">${msg}</div>`;
        }
    }

    // ========== Data Processing ==========

    getVolumeData(exerciseId = null) {
        // 12 tuần gần nhất
        const weeks = 12, labels = [], values = [];
        for (let i = weeks-1; i >= 0; i--) {
            const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - (i*7) - weekStart.getDay());
            weekStart.setHours(0,0,0,0);
            const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate()+6);
            weekEnd.setHours(23,59,59,999);
            const weekWorkouts = this.app.workoutHistory.filter(w=>{
                const d=new Date(w.date);
                return d>=weekStart && d<=weekEnd;
            });
            let volume = 0;
            weekWorkouts.forEach(w=>{
                w.exercises.forEach(ex=>{
                    if (!exerciseId || ex.id === exerciseId) {
                        volume += ex.sets.reduce((s, set)=>s+(set.weight*set.reps||0),0);
                    }
                });
            });
            labels.push(`Tuần ${weeks-i}`);
            values.push(volume);
        }
        return {labels, values};
    }

    getMuscleDistributionData() {
        const distribution = {};
        this.app.workoutHistory.forEach(w=>{
            const muscles = new Set();
            w.exercises.forEach(ex=>{
                muscles.add(this.app.getMuscleName(ex.muscle)||'Khác');
            });
            muscles.forEach(muscle=>{
                distribution[muscle] = (distribution[muscle]||0)+1;
            });
        });
        return {
            labels: Object.keys(distribution),
            values: Object.values(distribution)
        };
    }

    getHeatmapData() {
        // 52 tuần, 7 ngày
        const data = [];
        const today = new Date();
        const yearAgo = new Date(today);
        yearAgo.setDate(today.getDate() - (52*7) + 1);
        yearAgo.setHours(0,0,0,0);

        // Đếm workout từng ngày
        const workoutCounts = new Map();
        this.app.workoutHistory.forEach(w=>{
            const d = new Date(w.date).toDateString();
            workoutCounts.set(d, (workoutCounts.get(d)||0)+1);
        });

        for(let i=0; i<52*7; i++) {
            const currDate = new Date(yearAgo); currDate.setDate(yearAgo.getDate()+i);
            const weekIndex = Math.floor(i/7);
            const dayOfWeek = currDate.getDay();
            let yAxisDay = (7-dayOfWeek)%7;
            if(dayOfWeek===0) yAxisDay=0; else yAxisDay=7-dayOfWeek;
            const dateStr = currDate.toDateString();
            const count = workoutCounts.get(dateStr)||0;
            data.push({
                x: weekIndex,
                y: yAxisDay,
                v: count,
                date: currDate.toLocaleDateString('vi-VN')
            });
        }
        return data;
    }

    getPRTimelineData() {
        // Chỉ lấy 4 bài chính
        const targets = ['Bench Press','Squat','Deadlift','Overhead Press'];
        const targetExercises = this.app.exercises.filter(ex=>targets.includes(ex.name));
        const datasets=[], colors=['#4CAF50','#2196F3','#FFC107','#E91E63'];
        targetExercises.forEach((def, idx)=>{
            const prs=[]; let maxW=0;
            this.app.workoutHistory
                .sort((a,b)=>new Date(a.date)-new Date(b.date))
                .forEach(w=>{
                    const ex = w.exercises.find(e=>e.id===def.id);
                    if(ex){
                        const maxSet = ex.sets.reduce((maxSet,cur)=>
                            (cur.weight||0)>(maxSet.weight||0)?cur:
                            (cur.weight===maxSet.weight&&(cur.reps||0)>(maxSet.reps||0))?cur:maxSet
                        ,{weight:0,reps:0});
                        if(maxSet.weight>maxW){
                            maxW=maxSet.weight;
                            prs.push({
                                x: new Date(w.date).valueOf(),
                                y: maxSet.weight,
                                exercise: def.name,
                                reps: maxSet.reps,
                                date: new Date(w.date).toLocaleDateString('vi-VN')
                            });
                        }
                    }
                });
            if(prs.length)
                datasets.push({
                    label: def.name,
                    data: prs,
                    borderColor: colors[idx%colors.length],
                    backgroundColor: colors[idx%colors.length]+'88',
                    showLine: true, tension: 0.1
                });
        });
        return {datasets};
    }

    getStrengthStandardsData() {
        const bodyweight = parseFloat(localStorage.getItem('userBodyweight'))||75;
        const standards = [
            {name:'Bench Press',target:1.5},
            {name:'Squat',target:2.0},
            {name:'Deadlift',target:2.5},
            {name:'Overhead Press',target:1.0}
        ];
        const labels=[],current=[],targets=[],max1RM=0;
        standards.forEach(std=>{
            const def = this.app.exercises.find(e=>e.name===std.name);
            if(def){
                labels.push(std.name);
                let max1RMval=0;
                this.app.workoutHistory.forEach(w=>{
                    const ex = w.exercises.find(e=>e.id===def.id);
                    if(ex){
                        ex.sets.forEach(set=>{
                            if(set.weight>0&&set.reps>0){
                                const est1RM = set.weight*(1+set.reps/30);
                                if(est1RM>max1RMval) max1RMval=est1RM;
                            }
                        });
                    }
                });
                current.push(Math.round(max1RMval));
                targets.push(Math.round(bodyweight*std.target));
                if(max1RMval>max1RM) max1RM=max1RMval;
            }
        });
        return {
            labels,
            current,
            suggestedMax: Math.ceil((max1RM*1.1)/10)*10
        };
    }
}

// Xuất class để app.js sử dụng
window.AdvancedAnalytics = AdvancedAnalytics;

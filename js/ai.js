// ai.js - AI Features for Smart Recommendations

/**
 * Represents a basic linear regression model.
 */
class LinearRegressionModel {
    constructor() {
        this.slope = 0;
        this.intercept = 0;
        this.rSquared = 0;
    }

    /**
     * Fits the linear regression model to the provided data.
     * @param {Array<{x: number, y: number}>} data - Array of data points.
     */
    fit(data) {
        const n = data.length;
        if (n < 2) {
            this.slope = 0;
            this.intercept = n === 1 ? data[0].y : 0;
            this.rSquared = 0;
            return;
        }

        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        for (const point of data) {
            sumX += point.x;
            sumY += point.y;
            sumXY += point.x * point.y;
            sumX2 += point.x * point.x;
        }

        const xBar = sumX / n;
        const yBar = sumY / n;

        const denominator = (n * sumX2 - sumX * sumX);
        this.slope = (denominator === 0) ? 0 : (n * sumXY - sumX * sumY) / denominator;
        this.intercept = yBar - this.slope * xBar;

        let ssTotal = 0;
        let ssResidual = 0;
        for (const point of data) {
            ssTotal += (point.y - yBar) ** 2;
            const predictedY = this.slope * point.x + this.intercept;
            ssResidual += (point.y - predictedY) ** 2;
        }
        this.rSquared = (ssTotal === 0) ? 1 : Math.max(0, 1 - (ssResidual / ssTotal));
    }

    /**
     * Predicts a y value for a given x value.
     * @param {number} x - The x value.
     * @returns {number} The predicted y value.
     */
    predict(x) {
        return this.slope * x + this.intercept;
    }
}

/**
 * Manages exercise progression predictions.
 */
class ProgressionModel {
    constructor(gymTrackerAIInstance) {
        this.ai = gymTrackerAIInstance;
        this.regressionModel = new LinearRegressionModel();
    }

    /**
     * Predicts weight progression for a given exercise.
     * @param {string} exerciseId - The ID of the exercise.
     * @param {number} weeks - Number of weeks to predict.
     * @returns {Promise<{predictions: Array<{week: number, weight: number}>, rSquared: number, error?: string}>}
     */
    async predictProgress(exerciseId, weeks = 12) {
        const historicalData = this.ai.getExerciseHistory(exerciseId, 'maxWeight'); // [{x, y, date}]

        if (historicalData.length < 2) {
            return { predictions: [], rSquared: 0, error: 'Not enough data for prediction.' };
        }

        this.regressionModel.fit(historicalData);
        const predictions = [];
        const lastHistoricalX = historicalData[historicalData.length - 1].x;
        const lastWeight = historicalData[historicalData.length - 1].y;

        for (let i = 1; i <= weeks; i++) {
            // Predict for future points, continuing from the last historical x-value
            const futureX = lastHistoricalX + i;
            let predictedWeight = this.regressionModel.predict(futureX);
            predictedWeight = Math.max(0, predictedWeight); // Ensure non-negative
            predictedWeight = Math.round(predictedWeight / 2.5) * 2.5; // Round to nearest 2.5 increment

            // Simple cap to prevent overly optimistic predictions
            const reasonableCap = lastWeight * (1 + 0.04 * i); // e.g., max 4% increase per week from last actual
            predictedWeight = Math.min(predictedWeight, reasonableCap);


            predictions.push({
                week: i,
                weight: predictedWeight,
            });
        }
        return { predictions, rSquared: this.regressionModel.rSquared };
    }
}

/**
 * Provides form check cues for exercises.
 */
class FormCheckModel {
    constructor(gymTrackerAIInstance) {
        this.ai = gymTrackerAIInstance;
        this.cues = {
            'Bench Press': [
                'Shoulder blades retracted and down on the bench.',
                'Maintain a slight arch in the lower back, feet flat on the floor.',
                'Grip width appropriate for your goals (e.g., shoulder-width for general strength).',
                'Lower the bar to your mid-chest, elbows tucked slightly (around 45-75 degrees).',
                'Press explosively to lockout, maintaining control.',
            ],
            'Squat': [
                'Bar positioned securely on upper back/traps.',
                'Stance shoulder-width or slightly wider, toes pointed slightly out.',
                'Keep chest up and core braced throughout the movement.',
                'Initiate by pushing hips back, then bend knees.',
                'Descend until hip crease is below knee (or as flexibility allows).',
                'Drive through heels and midfoot to return to start.',
                'Knees track in line with toes, avoid valgus (knees caving in).',
            ],
            'Deadlift': [
                'Stance hip-width, bar over midfoot.',
                'Grip just outside shins (conventional).',
                'Maintain a neutral spine (flat back) from start to finish.',
                'Hips lower than shoulders, chest up.',
                'Engage lats to keep bar close to the body.',
                'Drive through legs to lift, then extend hips and knees together.',
                'Lower by reversing the motion, maintaining control and neutral spine.',
            ],
            'Overhead Press': [
                'Stance shoulder-width, core tight.',
                'Grip slightly wider than shoulders, bar resting on upper chest/shoulders.',
                'Press bar directly overhead, slightly back to align with spine at lockout.',
                'Keep elbows slightly forward during the press.',
                'Avoid excessive layback; engage glutes and core for stability.',
            ],
            'Pull-ups': [
                'Start from a full hang (dead hang) or active hang.',
                'Grip slightly wider than shoulder-width.',
                'Initiate by retracting and depressing scapulae (pull shoulder blades down and back).',
                'Pull elbows down towards your sides/ribs.',
                'Lead with the chest, aim to get chin over the bar.',
                'Control the descent back to a full hang.',
            ],
            'Bicep Curl': [
                'Stand or sit with good posture, core engaged.',
                'Keep elbows pinned to your sides (or slightly in front for certain variations).',
                'Curl the weight up, focusing on squeezing the biceps.',
                'Avoid using momentum or swinging the body.',
                'Control the eccentric (lowering) phase.',
            ],
            'Tricep Pushdown': [
                'Maintain an upright posture, core engaged.',
                'Elbows close to the body, fixed in position.',
                'Extend arms fully, squeezing the triceps at the bottom.',
                'Control the return of the attachment to the starting position.',
            ],
            'Leg Press': [
                'Place feet shoulder-width apart on the platform.',
                'Ensure lower back and hips remain in contact with the seat.',
                'Lower the weight by bending knees, tracking them over toes.',
                'Push through heels and midfoot to extend legs, avoid locking out knees completely.',
            ],
            'Rows (Barbell/Dumbbell/Cable)': [
                'Maintain a neutral spine, hinging at the hips if bent over.',
                'Initiate by retracting scapulae.',
                'Pull the weight towards your torso (target varies by row type: chest, stomach).',
                'Squeeze back muscles at the peak contraction.',
                'Control the eccentric phase.',
            ],
            // Add more exercises and cues as needed
        };
    }

    /**
     * Gets form cues for a specific exercise.
     * @param {string} exerciseName - The name of the exercise.
     * @returns {Array<string>} Array of form cues.
     */
    getFormCues(exerciseName) {
        const normalizedName = Object.keys(this.cues).find(key =>
            key.toLowerCase() === exerciseName.toLowerCase()
        );
        return this.cues[normalizedName] || [`No specific form cues available for ${exerciseName}. Ensure general good form.`];
    }
}

/**
 * Analyzes and suggests recovery times.
 */
class RecoveryModel {
    constructor(gymTrackerAIInstance) {
        this.ai = gymTrackerAIInstance;
        this.baseRecoveryTimes = { // Base recovery in days for moderate intensity
            'chest': 2, 'back': 2, 'legs': 3,
            'shoulders': 1.5, 'biceps': 1, 'triceps': 1,
            'core': 1, 'fullbody': 2, 'upperbody': 2, 'lowerbody': 3,
            'cardio': 0.5, 'other': 1
        };
    }

    /**
     * Estimates recovery time for a muscle group based on last workout intensity.
     * @param {string} muscleGroupId - The ID of the muscle group (e.g., 'chest', 'legs').
     * @param {number} intensity - Intensity score (0-10) of the last workout for this muscle.
     * @returns {number} Estimated recovery time in days.
     */
    getEstimatedRecoveryTime(muscleGroupId, intensity) {
        const muscleName = this.ai.app.getMuscleName(muscleGroupId)?.toLowerCase() || 'other';
        let baseTime = this.baseRecoveryTimes[muscleName] || this.baseRecoveryTimes['other'];

        // Adjust based on intensity (simple model)
        if (intensity > 7) baseTime *= 1.5;  // High intensity
        else if (intensity < 4) baseTime *= 0.75; // Low intensity

        // Consider user's overall training frequency/volume if available (more advanced)
        // For now, this is a simplified model.
        return Math.max(0.5, baseTime); // Minimum 0.5 days
    }
}

/**
 * Provides basic nutrition-related calculations.
 * Placeholder for more advanced nutrition features.
 */
class NutritionModel {
    constructor(gymTrackerAIInstance) {
        this.ai = gymTrackerAIInstance;
    }

    /**
     * Calculates Basal Metabolic Rate (BMR) using Mifflin-St Jeor equation.
     * @param {{weightKg: number, heightCm: number, ageYears: number, gender: 'male'|'female'}} userData
     * @returns {number|null} Estimated BMR in calories, or null if data is insufficient.
     */
    calculateBMR(userData) {
        const { weightKg, heightCm, ageYears, gender } = userData;
        if (!weightKg || !heightCm || !ageYears || !gender) {
            return null;
        }
        if (gender === 'male') {
            return (10 * weightKg) + (6.25 * heightCm) - (5 * ageYears) + 5;
        } else if (gender === 'female') {
            return (10 * weightKg) + (6.25 * heightCm) - (5 * ageYears) - 161;
        }
        return null;
    }

    /**
     * Calculates Total Daily Energy Expenditure (TDEE).
     * @param {number} bmr - Basal Metabolic Rate.
     * @param {number} activityLevel - Multiplier (e.g., 1.2 for sedentary, 1.55 for moderate).
     * @returns {number|null} Estimated TDEE in calories.
     */
    calculateTDEE(bmr, activityLevel) {
        if (!bmr || !activityLevel) return null;
        return bmr * activityLevel;
    }

    // Placeholder for macronutrient recommendations
    getMacronutrientTargets(tdee, goal = 'maintenance') { // goal: 'maintenance', 'loss', 'gain'
        if (!tdee) return null;
        // This is highly simplified. Real recommendations need more factors.
        const proteinGrPerKg = 1.6; // General recommendation
        const fatPercentage = 0.25; // 25% of calories from fat

        const weightKg = this.ai.app.userSettings?.weightKg || 70; // Example: get from app settings
        const proteinCals = proteinGrPerKg * weightKg * 4;
        const fatCals = tdee * fatPercentage;
        const carbCals = tdee - proteinCals - fatCals;

        return {
            proteinGrams: Math.round(proteinCals / 4),
            fatGrams: Math.round(fatCals / 9),
            carbGrams: Math.round(carbCals / 4),
            totalCalories: Math.round(tdee)
        };
    }
}

/**
 * Main AI class for Gym Tracker, integrating various AI models.
 */
class GymTrackerAI {
    constructor(gymTrackerAppInstance) {
        this.app = gymTrackerAppInstance; // Instance of the main GymTracker app
        this.models = {
            progression: new ProgressionModel(this),
            formCheck: new FormCheckModel(this),
            recovery: new RecoveryModel(this),
            nutrition: new NutritionModel(this),
        };
    }

    /**
     * Retrieves exercise history for regression analysis.
     * @param {string} exerciseId - The ID of the exercise.
     * @param {'maxWeight' | 'totalVolume'} metric - The metric to track.
     * @returns {Array<{x: number, y: number, date: string}>} Data points for regression.
     */
    getExerciseHistory(exerciseId, metric = 'maxWeight') {
        const history = [];
        // Ensure workouts are sorted by date if not already
        const sortedWorkoutHistory = [...this.app.workoutHistory].sort((a, b) => new Date(a.date) - new Date(b.date));

        sortedWorkoutHistory.forEach((workout) => {
            const exerciseInstance = workout.exercises.find(e => e.id === exerciseId);
            if (exerciseInstance) {
                let value = 0;
                if (metric === 'maxWeight') {
                    value = exerciseInstance.sets.reduce((max, set) => Math.max(max, set.weight || 0), 0);
                } else if (metric === 'totalVolume') {
                    value = exerciseInstance.sets.reduce((sum, set) => sum + (set.weight || 0) * (set.reps || 0), 0);
                }

                if (value > 0) {
                    // x is the index (time progression), y is the metric value
                    history.push({ x: history.length, y: value, date: workout.date });
                }
            }
        });
        return history;
    }

    /**
     * Suggests the next workout based on history, recovery, and goals.
     * This is a conceptual placeholder for a more complex recommendation system.
     * @returns {Promise<Object|null>} Suggested workout template or parameters.
     */
    async suggestNextWorkout() {
        // 1. Analyze recent muscle group usage
        const muscleGroupUsage = this._analyzeRecentMuscleGroups(7); // Last 7 days

        // 2. Check recovery status for each muscle group
        const suggestions = [];
        const allMuscleGroups = this.app.exercises.reduce((acc, ex) => {
            if (ex.muscle && !acc.find(m => m.id === ex.muscle)) {
                acc.push({ id: ex.muscle, name: this.app.getMuscleName(ex.muscle) });
            }
            return acc;
        }, []);


        for (const muscle of allMuscleGroups) {
            const usage = muscleGroupUsage[muscle.id] || { daysAgo: 999, intensitySum: 0, count: 0 };
            const avgIntensity = usage.count > 0 ? usage.intensitySum / usage.count : 0;
            const estimatedRecoveryTime = this.models.recovery.getEstimatedRecoveryTime(muscle.id, avgIntensity);

            if (usage.daysAgo >= estimatedRecoveryTime) {
                // Calculate priority (simple: longer since worked = higher priority)
                // More advanced: user goals, performance plateaus, etc.
                const priority = usage.daysAgo + (10 - avgIntensity); // Favor less recently worked or lower intensity
                suggestions.push({
                    muscleId: muscle.id,
                    muscleName: muscle.name,
                    priority: priority,
                    daysSinceLastWorkout: usage.daysAgo,
                });
            }
        }

        if (suggestions.length === 0) {
            // User might be overtraining or all muscles recently worked
            // Suggest rest or a light full-body/cardio session
            this.app.showToast("Muscles may need more recovery. Consider a rest day or light activity.", "info");
            return { type: 'rest_or_light', message: "All muscle groups seem recently trained. Consider rest or light cardio." };
        }

        // Sort by priority (higher is better)
        suggestions.sort((a, b) => b.priority - a.priority);

        // Select top 1-2 muscle groups for the workout
        const primaryTarget = suggestions[0];
        let secondaryTarget = null;
        if (suggestions.length > 1 && (primaryTarget.muscleId !== 'legs' && primaryTarget.muscleId !== 'fullbody')) { // Avoid pairing legs with another major group usually
             secondaryTarget = suggestions.find(s => s.muscleId !== primaryTarget.muscleId && !this._areAntagonisticOrTooSimilar(primaryTarget.muscleId, s.muscleId));
        }


        // 3. Generate a workout template (simple example)
        const suggestedTemplate = {
            name: `AI Suggested: ${primaryTarget.muscleName}${secondaryTarget ? ' & ' + secondaryTarget.muscleName : ''}`,
            exercises: [],
        };

        // Add 2-3 exercises for primary target
        this._addExercisesToTemplate(suggestedTemplate.exercises, primaryTarget.muscleId, 3);
        if (secondaryTarget) {
            this._addExercisesToTemplate(suggestedTemplate.exercises, secondaryTarget.muscleId, 2);
        }

        if (suggestedTemplate.exercises.length === 0) {
            return { type: 'no_exercises_found', message: "Could not find suitable exercises for the suggestion." };
        }
        return { type: 'workout_template', template: suggestedTemplate };
    }

    _areAntagonisticOrTooSimilar(muscleId1, muscleId2) {
        const pairings = {
            'chest': ['back'], // Antagonistic
            'biceps': ['triceps'], // Antagonistic
            'quadriceps': ['hamstrings'], // Antagonistic with legs
            // Avoid pairing large groups like 'legs' and 'back' in a quick suggestion
            'legs': ['back', 'chest', 'shoulders'],
            'fullbody': Object.keys(this.app.muscleGroups) // Fullbody shouldn't be paired
        };
        const m1Name = this.app.getMuscleName(muscleId1)?.toLowerCase();
        const m2Name = this.app.getMuscleName(muscleId2)?.toLowerCase();

        if (pairings[m1Name]?.includes(m2Name)) return true;
        if (pairings[m2Name]?.includes(m1Name)) return true;
        return false;
    }


    _addExercisesToTemplate(templateExercisesArray, muscleGroupId, count) {
        const suitableExercises = this.app.exercises
            .filter(ex => ex.muscle === muscleGroupId)
            .sort(() => 0.5 - Math.random()); // Shuffle

        for (let i = 0; i < Math.min(count, suitableExercises.length); i++) {
            templateExercisesArray.push({
                id: suitableExercises[i].id, // Exercise ID from app.exercises
                name: suitableExercises[i].name,
                muscle: suitableExercises[i].muscle,
                sets: this._generateSetsForExercise(suitableExercises[i]), // Default sets
            });
        }
    }

    _generateSetsForExercise(exercise) {
        // Simple default: 3 sets of 8-12 reps
        // Could be smarter: consider exercise type (compound vs isolation), user history
        const defaultSets = [];
        const reps = (exercise.type === 'compound' ? '6-10' : '10-15');
        for (let i = 0; i < 3; i++) {
            defaultSets.push({ reps: reps, weight: null, completed: false, rest: 60 });
        }
        return defaultSets;
    }


    /**
     * Analyzes muscle groups worked in recent workouts.
     * @param {number} daysLookback - Number of past days to analyze.
     * @returns {Object} Object mapping muscle group ID to usage stats {daysAgo, intensitySum, count}.
     */
    _analyzeRecentMuscleGroups(daysLookback) {
        const usage = {};
        const today = new Date();
        const lookbackDate = new Date(today);
        lookbackDate.setDate(today.getDate() - daysLookback);

        this.app.workoutHistory.forEach(workout => {
            const workoutDate = new Date(workout.date);
            if (workoutDate >= lookbackDate) {
                const daysAgo = Math.round((today - workoutDate) / (1000 * 60 * 60 * 24));
                workout.exercises.forEach(ex => {
                    const muscleId = ex.muscle || 'other'; // Assume 'other' if no muscle group
                    // Estimate intensity of this specific exercise instance (e.g., RPE if tracked, or volume)
                    // For simplicity, let's use a fixed intensity or derive from sets/reps/weight if complex.
                    // Here, a placeholder for workout.intensity or a default
                    const workoutIntensity = workout.perceivedIntensity || 5; // Assume a scale of 1-10

                    if (!usage[muscleId] || daysAgo < usage[muscleId].daysAgo) {
                        usage[muscleId] = { daysAgo: daysAgo, intensitySum: 0, count: 0 };
                    }
                    // If it's the same day, don't reset daysAgo, just add intensity
                    if (usage[muscleId].daysAgo === daysAgo) {
                         usage[muscleId].intensitySum += workoutIntensity; // Sum intensities if multiple workouts for same muscle on same 'most_recent' day
                         usage[muscleId].count++;
                    } else if (daysAgo < usage[muscleId].daysAgo) { // Update if this workout is more recent
                        usage[muscleId].daysAgo = daysAgo;
                        usage[muscleId].intensitySum = workoutIntensity;
                        usage[muscleId].count = 1;
                    }
                });
            }
        });
        return usage;
    }


    /**
     * Provides deload or training modification advice.
     * Placeholder function.
     */
    getDeloadRecommendation() {
        // Analyze training volume, intensity trends, fatigue markers (if tracked)
        // For example, if progress stalls for X weeks despite effort, or high fatigue.
        const recentPerformance = this.app.analytics?.getPerformanceTrend(30); // Trend over last 30 days
        if (recentPerformance === 'declining') {
            return "Performance is declining. Consider a deload week: reduce volume and intensity by 40-50%.";
        }
        // Add more sophisticated logic here
        return null;
    }
}

// Make the GymTrackerAI class available if app.js needs to instantiate it.
// If app.js already does `this.ai = new GymTrackerAI(this);`, then this line is not strictly needed for global scope.
// window.GymTrackerAI = GymTrackerAI;
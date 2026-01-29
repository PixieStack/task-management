from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List
import random
from app import models
from app.schemas_extended import (
    DietPreferenceCreate, DietPreferenceUpdate, DietPreferenceOut,
    MealEntryCreate, MealEntryOut, WaterEntryCreate, WaterEntryOut,
    DailyMealPlan, DietAnalytics
)
from app.auth import get_current_user, get_db

router = APIRouter(prefix="/api/diet", tags=["diet"])


# Meal database for AI-based meal planning
MEAL_DATABASE = {
    "breakfast": {
        "vegetarian": ["Oatmeal with fruits", "Veggie scramble with toast", "Greek yogurt with granola", "Smoothie bowl", "Avocado toast"],
        "vegan": ["Chia pudding", "Tofu scramble", "Smoothie bowl", "Overnight oats", "Fruit salad with nuts"],
        "keto": ["Eggs and avocado", "Bacon and cheese omelet", "Bulletproof coffee", "Keto pancakes", "Scrambled eggs with spinach"],
        "default": ["Scrambled eggs", "Pancakes", "Cereal with milk", "Toast with butter", "Bagel with cream cheese"]
    },
    "lunch": {
        "vegetarian": ["Veggie wrap", "Caprese salad", "Lentil soup", "Quinoa bowl", "Vegetable stir-fry"],
        "vegan": ["Buddha bowl", "Vegan burrito", "Lentil curry", "Chickpea salad", "Vegetable pad thai"],
        "keto": ["Grilled chicken salad", "Tuna lettuce wraps", "Cauliflower rice bowl", "Zucchini noodles", "Salmon with vegetables"],
        "default": ["Sandwich", "Pasta salad", "Chicken wrap", "Pizza slice", "Burger with fries"]
    },
    "dinner": {
        "vegetarian": ["Vegetable lasagna", "Stuffed bell peppers", "Mushroom risotto", "Eggplant parmesan", "Veggie curry"],
        "vegan": ["Tofu stir-fry", "Vegan chili", "Vegetable curry", "Quinoa stuffed peppers", "Bean burrito bowl"],
        "keto": ["Grilled steak with broccoli", "Baked salmon", "Chicken thighs with cauliflower", "Pork chops with asparagus", "Shrimp scampi"],
        "default": ["Grilled chicken with rice", "Spaghetti", "Tacos", "Steak with potatoes", "Fish and chips"]
    },
    "snacks": {
        "vegetarian": ["Hummus with veggies", "Cheese and crackers", "Trail mix", "Apple slices with peanut butter", "Greek yogurt"],
        "vegan": ["Fruit", "Nuts and seeds", "Energy balls", "Veggie sticks with hummus", "Rice cakes with almond butter"],
        "keto": ["Cheese cubes", "Nuts", "Pork rinds", "Celery with cream cheese", "Hard-boiled eggs"],
        "default": ["Chips", "Cookies", "Granola bar", "Fruit", "Popcorn"]
    }
}


@router.post("/preferences", response_model=DietPreferenceOut)
def set_diet_preference(preference: DietPreferenceCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Set or update diet preferences"""
    existing = db.query(models.DietPreference).filter(
        models.DietPreference.user_id == current_user.id
    ).first()
    
    if existing:
        for key, value in preference.dict(exclude_unset=True).items():
            setattr(existing, key, value)
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing
    else:
        db_pref = models.DietPreference(
            user_id=current_user.id,
            preference_type=preference.preference_type,
            allergies=preference.allergies or [],
            dislikes=preference.dislikes or [],
            health_goals=preference.health_goals,
            daily_calorie_target=preference.daily_calorie_target,
            water_target_ml=preference.water_target_ml or 2000
        )
        db.add(db_pref)
        db.commit()
        db.refresh(db_pref)
        return db_pref


@router.get("/preferences", response_model=DietPreferenceOut)
def get_diet_preference(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get user's diet preferences"""
    pref = db.query(models.DietPreference).filter(
        models.DietPreference.user_id == current_user.id
    ).first()
    if not pref:
        raise HTTPException(status_code=404, detail="No diet preferences set")
    return pref


@router.get("/meal-plan", response_model=DailyMealPlan)
def generate_meal_plan(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Generate AI-based daily meal plan based on preferences"""
    # Get user preferences
    pref = db.query(models.DietPreference).filter(
        models.DietPreference.user_id == current_user.id
    ).first()
    
    preference_type = pref.preference_type if pref and pref.preference_type else "default"
    
    # Get user's meal history to learn preferences
    recent_meals = db.query(models.MealEntry).filter(
        models.MealEntry.user_id == current_user.id
    ).order_by(models.MealEntry.date.desc()).limit(30).all()
    
    # Simple AI: Learn from user's logged meals
    user_meal_patterns = {}
    for meal in recent_meals:
        if meal.meal_type not in user_meal_patterns:
            user_meal_patterns[meal.meal_type] = []
        user_meal_patterns[meal.meal_type].append(meal.description)
    
    # Generate plan
    plan = {}
    for meal_type in ["breakfast", "lunch", "dinner", "snacks"]:
        available_meals = MEAL_DATABASE[meal_type].get(preference_type, MEAL_DATABASE[meal_type]["default"])
        
        # If user has logged meals of this type, include some of those
        if meal_type in user_meal_patterns and user_meal_patterns[meal_type]:
            available_meals = available_meals + user_meal_patterns[meal_type]
        
        # Remove duplicates and select random meals
        available_meals = list(set(available_meals))
        num_suggestions = 2 if meal_type == "snacks" else 1
        plan[meal_type] = random.sample(available_meals, min(num_suggestions, len(available_meals)))
    
    # Generate tips based on goals
    tips = []
    if pref and pref.health_goals:
        tips.append(f"Focus on: {pref.health_goals}")
    tips.append(f"Drink {pref.water_target_ml if pref else 2000}ml of water today")
    tips.append("Eat slowly and mindfully")
    if preference_type == "keto":
        tips.append("Keep carbs under 50g today")
    elif preference_type == "vegan":
        tips.append("Ensure adequate protein intake")
    
    return DailyMealPlan(
        breakfast=plan["breakfast"],
        lunch=plan["lunch"],
        dinner=plan["dinner"],
        snacks=plan["snacks"],
        tips=tips
    )


@router.post("/meals", response_model=MealEntryOut, status_code=status.HTTP_201_CREATED)
def log_meal(meal: MealEntryCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Log a meal (can only log each meal type once per day)"""
    today = datetime.utcnow().date()
    
    # Check if meal type already logged today
    existing = db.query(models.MealEntry).filter(
        models.MealEntry.user_id == current_user.id,
        models.MealEntry.meal_type == meal.meal_type,
        models.MealEntry.date >= datetime(today.year, today.month, today.day),
        models.MealEntry.date < datetime(today.year, today.month, today.day) + timedelta(days=1)
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"You have already logged {meal.meal_type} for today. You can only log each meal type once per day."
        )
    
    db_meal = models.MealEntry(
        user_id=current_user.id,
        date=datetime.utcnow(),
        meal_time=datetime.utcnow(),
        meal_type=meal.meal_type,
        description=meal.description,
        calories=meal.calories
    )
    db.add(db_meal)
    db.commit()
    db.refresh(db_meal)
    return db_meal


@router.get("/meals", response_model=List[MealEntryOut])
def get_meals(days: int = 7, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get meal entries"""
    start_date = datetime.utcnow() - timedelta(days=days)
    meals = db.query(models.MealEntry).filter(
        models.MealEntry.user_id == current_user.id,
        models.MealEntry.date >= start_date
    ).order_by(models.MealEntry.date.desc()).all()
    return meals


@router.post("/water", response_model=WaterEntryOut, status_code=status.HTTP_201_CREATED)
def log_water(water: WaterEntryCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Log water intake"""
    db_water = models.WaterEntry(
        user_id=current_user.id,
        date=datetime.utcnow(),
        time=datetime.utcnow(),
        amount_ml=water.amount_ml
    )
    db.add(db_water)
    db.commit()
    db.refresh(db_water)
    return db_water


@router.get("/water", response_model=List[WaterEntryOut])
def get_water_entries(days: int = 7, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get water intake entries"""
    start_date = datetime.utcnow() - timedelta(days=days)
    entries = db.query(models.WaterEntry).filter(
        models.WaterEntry.user_id == current_user.id,
        models.WaterEntry.date >= start_date
    ).order_by(models.WaterEntry.date.desc()).all()
    return entries


@router.get("/analytics", response_model=DietAnalytics)
def get_diet_analytics(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get diet and hydration analytics"""
    today = datetime.utcnow().date()
    week_ago = today - timedelta(days=7)
    
    # Get meals
    meals = db.query(models.MealEntry).filter(
        models.MealEntry.user_id == current_user.id,
        models.MealEntry.date >= datetime(week_ago.year, week_ago.month, week_ago.day)
    ).all()
    
    # Get water entries for today
    water_today = db.query(models.WaterEntry).filter(
        models.WaterEntry.user_id == current_user.id,
        models.WaterEntry.date >= datetime(today.year, today.month, today.day)
    ).all()
    
    total_water_today = sum(w.amount_ml for w in water_today)
    
    # Get water target
    pref = db.query(models.DietPreference).filter(
        models.DietPreference.user_id == current_user.id
    ).first()
    water_target = pref.water_target_ml if pref else 2000
    
    # Calculate meal distribution
    meal_distribution = {}
    for meal in meals:
        meal_type = meal.meal_type
        meal_distribution[meal_type] = meal_distribution.get(meal_type, 0) + 1
    
    # Calculate average calories
    calories_list = [m.calories for m in meals if m.calories]
    avg_calories = sum(calories_list) / len(calories_list) if calories_list else 0
    
    # Calculate hydration streak
    hydration_streak = 0
    for i in range(7):
        check_date = today - timedelta(days=i)
        day_water = db.query(models.WaterEntry).filter(
            models.WaterEntry.user_id == current_user.id,
            models.WaterEntry.date >= datetime(check_date.year, check_date.month, check_date.day),
            models.WaterEntry.date < datetime(check_date.year, check_date.month, check_date.day) + timedelta(days=1)
        ).all()
        day_total = sum(w.amount_ml for w in day_water)
        if day_total >= water_target:
            hydration_streak += 1
        else:
            break
    
    return DietAnalytics(
        total_meals_logged=len(meals),
        water_intake_today=total_water_today,
        water_goal_percentage=(total_water_today / water_target * 100) if water_target > 0 else 0,
        average_calories=int(avg_calories),
        meal_distribution=meal_distribution,
        hydration_streak=hydration_streak
    )

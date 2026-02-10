import json
import datetime
import os
from garminconnect import Garmin

def save_json(name, data):
    path = os.path.join("garmin_dumps", f"{name}.json")
    with print_saving(name):
        with open(path, "w") as f:
            json.dump(data, f, indent=2)

class print_saving:
    def __init__(self, name): self.name = name
    def __enter__(self): print(f"Saving {self.name}...")
    def __exit__(self, *args): pass

def dump_garmin_data():
    email = ""
    password = ""
    
    try:
        print("Logging in...")
        client = Garmin(email, password)
        client.login()
        
        os.makedirs("garmin_dumps", exist_ok=True)
        
        save_json("full_name", client.get_full_name())
        save_json("unit_system", client.get_unit_system())
        
        profile = client.get_user_profile()
        save_json("user_profile", profile)
        save_json("user_settings", client.get_userprofile_settings())
        
        print("Fetching activities...")
        activities = client.get_activities(0, 50) 
        
        # Filter for unique activity types
        unique_activities = []
        seen_types = set()
        for a in activities:
            type_key = a.get("activityType", {}).get("typeKey")
            if type_key not in seen_types:
                unique_activities.append(a)
                seen_types.add(type_key)
        
        save_json("activities_summary", unique_activities[:5])
        
        if unique_activities:
            latest = unique_activities[0]
            latest_id = latest["activityId"]
            print(f"Fetching details for: {latest.get('activityName')} ({latest_id})")
            
            # Truncate large detail fields for LLM friendliness
            details = client.get_activity_details(latest_id)
            if "charts" in details:
                for chart_type in details["charts"]:
                    if "metrics" in details["charts"][chart_type]:
                        details["charts"][chart_type]["metrics"] = details["charts"][chart_type]["metrics"][:10]
            
            save_json("latest_activity_details", details)
            save_json("latest_activity_hr_in_zones", client.get_activity_hr_in_timezones(latest_id))
            
            splits = client.get_activity_splits(latest_id)
            if "lapDTOs" in splits: splits["lapDTOs"] = splits["lapDTOs"][:3]
            save_json("latest_activity_splits", splits)
            
        today = datetime.date.today().isoformat()
        yesterday = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
        
        save_json("stats_today", client.get_stats(today))
        save_json("steps_today", client.get_daily_steps(yesterday, today))
        save_json("rhr_yesterday", client.get_rhr_day(yesterday))
        save_json("training_readiness", client.get_training_readiness(today))
        save_json("training_status", client.get_training_status(today))
        
        system_user_id = profile.get("systemuserId") or profile.get("systemuser_id")
        if system_user_id:
            save_json("gear", client.get_gear(system_user_id))
        
        print(f"\nSuccess! Examples saved to garmin_dumps/")
        
    except Exception as e:
        print(f"\nError: {str(e)}")

if __name__ == "__main__":
    dump_garmin_data()

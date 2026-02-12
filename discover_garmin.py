
import json
import datetime
import os
import inspect
from garminconnect import Garmin

# Configuration - update these or use environment variables
EMAIL = "odd.gunnar.aspaas@gmail.com"
PASSWORD = "WqrzGldnWjZsn110797"

def save_json(name, data):
    os.makedirs("garmin_discovery", exist_ok=True)
    path = os.path.join("garmin_discovery", f"{name}.json")
    try:
        with open(path, "w") as f:
            json.dump(data, f, indent=2, default=str)
        print(f"✅ Saved {name}")
    except Exception as e:
        print(f"❌ Failed to save {name}: {e}")

def get_arg_names(func):
    return inspect.getfullargspec(func).args[1:] # Skip 'self'

def discover_garmin_api():
    try:
        print("Logging in to Garmin...")
        client = Garmin(EMAIL, PASSWORD)
        client.login()
        
        # Get common IDs for specific calls
        profile = client.get_user_profile()
        system_user_id = profile.get("systemuserId") or profile.get("systemuser_id")
        
        activities = client.get_activities(0, 1)
        latest_id = activities[0]["activityId"] if activities else None
        
        today = datetime.date.today().isoformat()
        yesterday = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
        
        # Mapping of common parameters for discovery
        param_map = {
            'activity_id': latest_id,
            'activityId': latest_id,
            'id': latest_id,
            'date': today,
            'dob': today,
            'start_date': yesterday,
            'end_date': today,
            'start': 0,
            'limit': 1,
            'c_id': system_user_id,
        }

        methods = [m for m in dir(Garmin) if not m.startswith("_") and m.startswith("get")]
        
        discovery_results = {}

        for method_name in methods:
            print(f"Attempting {method_name}...")
            method = getattr(client, method_name)
            args = get_arg_names(method)
            
            call_args = {}
            for arg in args:
                if arg in param_map:
                    call_args[arg] = param_map[arg]
                elif "date" in arg.lower():
                    call_args[arg] = today
                elif arg == "system_user_id":
                    call_args[arg] = system_user_id

            try:
                # Some methods might need specific positional args or fail if missing
                # This is a best-effort discovery
                if not args:
                    data = method()
                else:
                    # Try calling with mapped args
                    data = method(**call_args)
                
                # Truncate large lists for LLM context
                if isinstance(data, list) and len(data) > 3:
                    data = data[:3]
                elif isinstance(data, dict):
                    # Shallow copy to avoid modifying original if returned by reference
                    data = data.copy()
                    for k, v in data.items():
                        if isinstance(v, list) and len(v) > 5:
                            data[k] = v[:5]

                discovery_results[method_name] = {
                    "status": "success",
                    "args": args,
                    "sample": data
                }
                save_json(method_name, data)
                
            except Exception as e:
                discovery_results[method_name] = {
                    "status": "error",
                    "args": args,
                    "error": str(e)
                }
                print(f"⚠️ {method_name} failed: {e}")

        # Save the master mapping
        save_json("_api_mapping", discovery_results)
        
        print(f"\nDiscovery complete. Results in garmin_discovery/")
        
    except Exception as e:
        print(f"\nCritical Error: {str(e)}")

if __name__ == "__main__":
    discover_garmin_api()

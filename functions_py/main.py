from firebase_functions import https_fn, options
from firebase_admin import initialize_app, firestore
from garminconnect import Garmin
import datetime
import logging

initialize_app()

@https_fn.on_call(region="europe-west1")
def get_garmin_activities(req: https_fn.CallableRequest):
    if req.auth is None:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="The function must be called while authenticated."
        )
    
    uid = req.auth.uid
    db = firestore.client()
    user_ref = db.collection("users").document(uid)
    user_data = user_ref.get().to_dict() or {}

    email = user_data.get("garminEmail")
    password = user_data.get("garminPassword")

    if not email or not password:
        return {"needsAuth": True, "message": "Garmin credentials missing."}

    try:
        client = Garmin(email, password)
        client.login()
        
        # Garmin activities fetch
        # By default get last 20
        activities = client.get_activities(0, 20)
        
        # For exploring data, we'll return a few specific details too
        stats = client.get_stats(datetime.date.today().isoformat())
        full_name = client.get_full_name()
        
        return {
            "activities": activities,
            "stats": stats,
            "fullName": full_name,
            "success": True
        }
        
    except Exception as e:
        logging.error(f"Garmin sync error: {str(e)}")
        if "MFA" in str(e).upper():
            return {"needsMFA": True}
        return {"error": str(e)}

@https_fn.on_call(region="europe-west1")
def get_garmin_activity_details(req: https_fn.CallableRequest):
    if req.auth is None:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="The function must be called while authenticated."
        )
    
    activity_id = req.data.get("activityId")
    if not activity_id:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Activity ID is required."
        )

    uid = req.auth.uid
    db = firestore.client()
    user_data = db.collection("users").document(uid).get().to_dict() or {}
    email, password = user_data.get("garminEmail"), user_data.get("garminPassword")

    if not email or not password:
        return {"needsAuth": True}

    try:
        client = Garmin(email, password)
        client.login()
        
        # get_activity_details returns the chart data and polyline
        details = client.get_activity_details(activity_id)
        
        return {
            "details": details,
            "success": True
        }
    except Exception as e:
        logging.error(f"Garmin details error: {str(e)}")
        return {"error": str(e)}

@https_fn.on_call(region="europe-west1")
def link_garmin_account(req: https_fn.CallableRequest):
    if req.auth is None:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="The function must be called while authenticated."
        )
    
    email = req.data.get("email")
    password = req.data.get("password")
    mfa_code = req.data.get("mfaCode")
    
    if not email or not password:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Email and password required."
        )

    uid = req.auth.uid
    db = firestore.client()
    
    try:
        client = Garmin(email, password, return_on_mfa=True)
        result1, result2 = client.login()
        
        if result1 == "needs_mfa":
            if not mfa_code:
                return {"status": "needs_mfa", "state": result2}
            else:
                client.resume_login(result2, mfa_code)
        
        # If we get here, login worked. Store credentials.
        user_ref = db.collection("users").document(uid)
        if not user_ref.get().exists:
            user_ref.set({
                "garminEmail": email,
                "garminPassword": password,
                "updatedAt": firestore.SERVER_TIMESTAMP
            })
        else:
            user_ref.update({
                "garminEmail": email,
                "garminPassword": password,
                "updatedAt": firestore.SERVER_TIMESTAMP
            })
        
        return {"success": True}
        
    except Exception as e:
        logging.error(f"Garmin link error: {str(e)}")
        return {"error": str(e)}

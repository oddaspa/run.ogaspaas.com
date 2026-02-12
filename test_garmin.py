from garminconnect import Garmin
import inspect

methods = [m for m in dir(Garmin) if not m.startswith("_") and m.startswith("get")]
print(methods)

g = Garmin(email="odd.gunnar.aspaas@gmail.com", password="WqrzGldnWjZsn110797")

a = g.get_activities(0,limit=1)

print(a)

"""
AstroBidhi - VedicAstro FastAPI Backend (Port 8089)
"""

import os
os.environ['SE_EPHE_PATH'] = '/home/z/.venv/lib/python3.12/site-packages/flatlib/resources/swefiles'

import swisseph
swisseph.set_ephe_path('/home/z/.venv/lib/python3.12/site-packages/flatlib/resources/swefiles')

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json

from vedicastro import VedicAstro

app = FastAPI(title="AstroBidhi API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChartInput(BaseModel):
    year: int
    month: int
    day: int
    hour: int
    minute: int
    second: int
    utc: str = "+05:30"
    latitude: float
    longitude: float
    ayanamsa: str = "Lahiri"
    house_system: str = "Placidus"

def nt_to_dict(obj):
    """Recursively convert namedtuples to dicts."""
    if hasattr(obj, '_asdict'):
        return {k: nt_to_dict(v) for k, v in obj._asdict().items()}
    elif isinstance(obj, list):
        return [nt_to_dict(i) for i in obj]
    elif isinstance(obj, dict):
        return {k: nt_to_dict(v) for k, v in obj.items()}
    elif isinstance(obj, (str, int, float, bool, type(None))):
        return obj
    else:
        try:
            return json.loads(json.dumps(obj, default=str))
        except:
            return str(obj)

def compute_horoscope(data: ChartInput):
    """Core computation shared across endpoints."""
    h = VedicAstro.VedicHoroscopeData(
        year=data.year, month=data.month, day=data.day,
        hour=data.hour, minute=data.minute, second=data.second,
        utc=data.utc, latitude=data.latitude, longitude=data.longitude,
        ayanamsa=data.ayanamsa, house_system=data.house_system
    )
    chart = h.generate_chart()
    planets = h.get_planets_data_from_chart(chart)
    houses = h.get_houses_data_from_chart(chart)
    aspects = h.get_planetary_aspects(chart)
    dasa = h.compute_vimshottari_dasa(chart)

    # Build rasi_planets map for chart rendering
    rasi_planets = {}
    for p in planets:
        rasi_planets.setdefault(p.Rasi, []).append({
            "name": p.Object, "retrograde": p.isRetroGrade,
            "longitude": p.SignLonDMS, "nakshatra": p.Nakshatra,
            "rasiLord": p.RasiLord, "nakshatraLord": p.NakshatraLord,
            "subLord": p.SubLord, "houseNr": p.HouseNr
        })

    house_chart = {}
    for hh in houses:
        house_chart[hh.HouseNr] = {
            "rasi": hh.Rasi, "longitude": hh.SignLonDMS,
            "nakshatra": hh.Nakshatra, "rasiLord": hh.RasiLord,
            "nakshatraLord": hh.NakshatraLord, "subLord": hh.SubLord
        }

    return {
        "planets_data": nt_to_dict(planets),
        "houses_data": nt_to_dict(houses),
        "planetary_aspects": nt_to_dict(aspects),
        "vimshottari_dasa": dasa,
        "rasi_planets": rasi_planets,
        "house_chart": house_chart,
    }

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/get_all_horoscope_data")
def get_all_horoscope_data(data: ChartInput):
    try:
        result = compute_horoscope(data)
        result["planet_significators"] = []
        result["house_significators"] = []
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/get_horary_data")
def get_horary_data(data: ChartInput):
    try:
        result = compute_horoscope(data)
        result["horary_number"] = 0
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/get_transit_data")
def get_transit_data(data: ChartInput):
    try:
        from datetime import datetime
        now = datetime.now()
        h = VedicAstro.VedicHoroscopeData(
            year=now.year, month=now.month, day=now.day,
            hour=now.hour, minute=now.minute, second=now.second,
            utc=data.utc, latitude=data.latitude, longitude=data.longitude,
            ayanamsa=data.ayanamsa, house_system=data.house_system
        )
        chart = h.generate_chart()
        planets = h.get_planets_data_from_chart(chart)
        return {"date": now.isoformat(), "planets_data": nt_to_dict(planets)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/get_dasa_data")
def get_dasa_data(data: ChartInput):
    try:
        h = VedicAstro.VedicHoroscopeData(
            year=data.year, month=data.month, day=data.day,
            hour=data.hour, minute=data.minute, second=data.second,
            utc=data.utc, latitude=data.latitude, longitude=data.longitude,
            ayanamsa=data.ayanamsa, house_system=data.house_system
        )
        chart = h.generate_chart()
        dasa = h.compute_vimshottari_dasa(chart)
        return {"vimshottari_dasa": dasa}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/get_aspects_data")
def get_aspects_data(data: ChartInput):
    try:
        h = VedicAstro.VedicHoroscopeData(
            year=data.year, month=data.month, day=data.day,
            hour=data.hour, minute=data.minute, second=data.second,
            utc=data.utc, latitude=data.latitude, longitude=data.longitude,
            ayanamsa=data.ayanamsa, house_system=data.house_system
        )
        chart = h.generate_chart()
        aspects = h.get_planetary_aspects(chart)
        return {"planetary_aspects": nt_to_dict(aspects)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8089, log_level="info", timeout_keep_alive=120)

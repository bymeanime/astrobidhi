"""
AstroBidhi - VedicAstro FastAPI Backend (Port 8089)
"""

import os
import sys

# ============ Patch flatlib.const with AY_* ayanamsa constants ============
# flatlib 0.2.3 is missing these constants that vedicastro expects.
# This MUST run before `from vedicastro import VedicAstro`
try:
    import flatlib.const as _flatlib_const
    _MISSING_AY = {
        'AY_LAHIRI': 1,
        'AY_LAHIRI_1940': 3,
        'AY_LAHIRI_VP285': 4,
        'AY_LAHIRI_ICRC': 5,
        'AY_RAMAN': 2,
        'AY_KRISHNAMURTI': 6,
        'AY_KRISHNAMURTI_SENTHILATHIBAN': 7,
    }
    for attr, val in _MISSING_AY.items():
        if not hasattr(_flatlib_const, attr):
            setattr(_flatlib_const, attr, val)
except Exception as e:
    print(f"[index.py] Warning: Could not patch flatlib.const: {e}", file=sys.stderr)

# ============ House System & Ayanamsa Normalization ============
HOUSE_SYSTEM_MAP = {
    'WHOLE_SIGN': 'Whole Sign', 'WHOLE': 'Whole Sign', 'PLACIDUS': 'Placidus',
    'EQUAL': 'Equal', 'WHOLE SIGN': 'Whole Sign', 'KOCH': 'Koch',
    'PORPHYRIUS': 'Porphyrius', 'REGIOMONTANUS': 'Regiomontanus',
    'CAMPANUS': 'Campanus', 'TOPOCENTRIC': 'Topocentric', 'MERIDIAN': 'Meridian',
}

AYANAMSA_MAP = {
    'LAHIRI': 'Lahiri', 'KRISHNAMURTI': 'Krishnamurti', 'RAMAN': 'Raman',
    'KP': 'Krishnamurti', 'KRISHNAMURTI_KP': 'Krishnamurti',
    'FAKYRAMAN': 'Raman', 'YUKTESHWAR': 'Yukteshwar', 'USHASHASI': 'Ushashashi',
}

def normalize_house_system(val):
    if not val:
        return 'Placidus'
    return HOUSE_SYSTEM_MAP.get(val.upper().replace(' ', '_'), val)

def normalize_ayanamsa(val):
    if not val:
        return 'Lahiri'
    return AYANAMSA_MAP.get(val.upper().replace(' ', '_'), val)

def normalize_utc(val):
    if val is None:
        return '+05:30'
    if isinstance(val, str) and ':' in val:
        if not val.startswith('+') and not val.startswith('-'):
            val = '+' + val
        return val
    try:
        num = float(val)
        sign = '+' if num >= 0 else '-'
        num = abs(num)
        hours = int(num)
        minutes = int(round((num - hours) * 60))
        if minutes == 60:
            hours += 1
            minutes = 0
        return f'{sign}{hours:02d}:{minutes:02d}'
    except (ValueError, TypeError):
        return str(val)

# ============ Find Swiss Ephemeris files ============
def find_ephe_path():
    env_path = os.environ.get('SE_EPHE_PATH')
    if env_path and os.path.exists(env_path):
        return env_path

    import importlib.util
    spec = importlib.util.find_spec('flatlib')
    if spec and spec.origin:
        flatlib_dir = os.path.dirname(spec.origin)
        ephe_path = os.path.join(flatlib_dir, 'resources', 'swefiles')
        if os.path.exists(ephe_path):
            return ephe_path

    for path in sys.path:
        candidate = os.path.join(path, 'flatlib', 'resources', 'swefiles')
        if os.path.exists(candidate):
            return candidate

    return '/usr/local/lib/python3.12/site-packages/flatlib/resources/swefiles'

ephe_path = find_ephe_path()
os.environ['SE_EPHE_PATH'] = ephe_path

import swisseph
swisseph.set_ephe_path(ephe_path)

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
    # Normalize inputs for vedicastro compatibility
    utc_val = normalize_utc(data.utc)
    ayanamsa_val = normalize_ayanamsa(data.ayanamsa)
    house_system_val = normalize_house_system(data.house_system)

    h = VedicAstro.VedicHoroscopeData(
        year=data.year, month=data.month, day=data.day,
        hour=data.hour, minute=data.minute, second=data.second,
        utc=utc_val, latitude=data.latitude, longitude=data.longitude,
        ayanamsa=ayanamsa_val, house_system=house_system_val
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
            utc=normalize_utc(data.utc), latitude=data.latitude, longitude=data.longitude,
            ayanamsa=normalize_ayanamsa(data.ayanamsa), house_system=normalize_house_system(data.house_system)
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
            utc=normalize_utc(data.utc), latitude=data.latitude, longitude=data.longitude,
            ayanamsa=normalize_ayanamsa(data.ayanamsa), house_system=normalize_house_system(data.house_system)
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
            utc=normalize_utc(data.utc), latitude=data.latitude, longitude=data.longitude,
            ayanamsa=normalize_ayanamsa(data.ayanamsa), house_system=normalize_house_system(data.house_system)
        )
        chart = h.generate_chart()
        aspects = h.get_planetary_aspects(chart)
        return {"planetary_aspects": nt_to_dict(aspects)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8089, log_level="info", timeout_keep_alive=120)

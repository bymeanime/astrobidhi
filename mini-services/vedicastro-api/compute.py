import os
import sys
import json

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
    print(f"[compute.py] Warning: Could not patch flatlib.const: {e}", file=sys.stderr)

# ============ House System Normalization ============
# Frontend sends "Whole Sign" but vedicastro expects "Whole Sign"
# Some versions accept both, but we normalize to be safe
HOUSE_SYSTEM_MAP = {
    'WHOLE_SIGN': 'Whole Sign',
    'WHOLE': 'Whole Sign',
    'PLACIDUS': 'Placidus',
    'EQUAL': 'Equal',
    'WHOLE SIGN': 'Whole Sign',
    'KOCH': 'Koch',
    'PORPHYRIUS': 'Porphyrius',
    'REGIOMONTANUS': 'Regiomontanus',
    'CAMPANUS': 'Campanus',
    'TOPOCENTRIC': 'Topocentric',
    'MERIDIAN': 'Meridian',
}

# ============ Ayanamsa Normalization ============
AYANAMSA_MAP = {
    'LAHIRI': 'Lahiri',
    'KRISHNAMURTI': 'Krishnamurti',
    'RAMAN': 'Raman',
    'KP': 'Krishnamurti',
    'KRISHNAMURTI_KP': 'Krishnamurti',
    'FAKYRAMAN': 'Raman',
    'YUKTESHWAR': 'Yukteshwar',
    'USHASHASI': 'Ushashashi',
}

def normalize_house_system(val):
    """Normalize house system name from frontend to vedicastro format."""
    if not val:
        return 'Placidus'
    upper = val.upper().replace(' ', '_')
    return HOUSE_SYSTEM_MAP.get(upper, val)

def normalize_ayanamsa(val):
    """Normalize ayanamsa name from frontend to vedicastro format."""
    if not val:
        return 'Lahiri'
    upper = val.upper().replace(' ', '_')
    return AYANAMSA_MAP.get(upper, val)

def normalize_utc(val):
    """Convert UTC offset to the format vedicastro expects.

    Frontend may send: '5.5' (number), '+05:30' (string), 5.5 (float), etc.
    VedicAstro expects: '+05:30' string format
    """
    if val is None:
        return '+05:30'

    # Already a string in the right format (contains ':' and starts with +/-)
    if isinstance(val, str) and (':' in val):
        # Ensure it starts with + or -
        if not val.startswith('+') and not val.startswith('-'):
            val = '+' + val
        return val

    # Numeric offset (e.g., 5.5 for IST)
    try:
        num = float(val)
        sign = '+' if num >= 0 else '-'
        num = abs(num)
        hours = int(num)
        minutes = int(round((num - hours) * 60))
        # Handle minute overflow (e.g., 60 minutes)
        if minutes == 60:
            hours += 1
            minutes = 0
        return f'{sign}{hours:02d}:{minutes:02d}'
    except (ValueError, TypeError):
        # Return as-is and let vedicastro handle it
        return str(val)

# ============ Find Swiss Ephemeris files ============
def find_ephe_path():
    """Locate Swiss Ephemeris files in the Python installation."""
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

from vedicastro import VedicAstro

def nt_to_dict(obj):
    if hasattr(obj, '_asdict'):
        return {k: nt_to_dict(v) for k, v in obj._asdict().items()}
    elif isinstance(obj, list):
        return [nt_to_dict(i) for i in obj]
    elif isinstance(obj, dict):
        return {k: nt_to_dict(v) for k, v in obj.items()}
    elif isinstance(obj, (str, int, float, bool, type(None))):
        return obj
    else:
        try: return json.loads(json.dumps(obj, default=str))
        except: return str(obj)

if __name__ == '__main__':
    input_data = json.loads(sys.stdin.read())
    endpoint = input_data.get('endpoint', 'get_all_horoscope_data')
    params = input_data.get('params', {})

    try:
        # Normalize inputs for vedicastro compatibility
        utc_val = normalize_utc(params.get('utc', '+05:30'))
        ayanamsa_val = normalize_ayanamsa(params.get('ayanamsa', 'Lahiri'))
        house_system_val = normalize_house_system(params.get('house_system', 'Placidus'))

        h = VedicAstro.VedicHoroscopeData(
            year=params['year'], month=params['month'], day=params['day'],
            hour=params['hour'], minute=params['minute'], second=params['second'],
            utc=utc_val,
            latitude=params['latitude'], longitude=params['longitude'],
            ayanamsa=ayanamsa_val,
            house_system=house_system_val
        )
        chart = h.generate_chart()
        planets = h.get_planets_data_from_chart(chart)
        houses = h.get_houses_data_from_chart(chart)
        aspects = h.get_planetary_aspects(chart)
        dasa = h.compute_vimshottari_dasa(chart)

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

        result = {
            "planets_data": nt_to_dict(planets),
            "houses_data": nt_to_dict(houses),
            "planetary_aspects": nt_to_dict(aspects),
            "vimshottari_dasa": dasa,
            "rasi_planets": rasi_planets,
            "house_chart": house_chart,
            "planet_significators": [],
            "house_significators": [],
        }
        print(json.dumps(result))
    except Exception as e:
        import traceback
        traceback.print_exc(file=sys.stderr)
        print(json.dumps({"error": str(e)}))

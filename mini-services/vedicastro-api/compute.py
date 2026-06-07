import os
os.environ['SE_EPHE_PATH'] = '/home/z/.venv/lib/python3.12/site-packages/flatlib/resources/swefiles'
import swisseph
swisseph.set_ephe_path('/home/z/.venv/lib/python3.12/site-packages/flatlib/resources/swefiles')

import sys
import json
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
        h = VedicAstro.VedicHoroscopeData(
            year=params['year'], month=params['month'], day=params['day'],
            hour=params['hour'], minute=params['minute'], second=params['second'],
            utc=params.get('utc', '+05:30'),
            latitude=params['latitude'], longitude=params['longitude'],
            ayanamsa=params.get('ayanamsa', 'Lahiri'),
            house_system=params.get('house_system', 'Placidus')
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

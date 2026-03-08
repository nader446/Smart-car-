from flask import Flask, jsonify
from flask_cors import CORS
import random
import socket
import time

app = Flask(__name__)
CORS(app)

# متغيرات الحالة
connected = False
simulation_mode = True
device_name = None
real_elm_socket = None

# إعدادات الاتصال بجهاز ELM327 حقيقي
ELM327_IP = "192.168.0.10"  # الـ IP الافتراضي لجهاز ELM327
ELM327_PORT = 35000

# بيانات المحاكاة
def generate_mock_data():
    return {
        'rpm': 750 + random.randint(-20, 20),
        'load': 25 + random.uniform(-2, 2),
        'coolant_temp': 90 + random.randint(-2, 2),
        'fuel_status': random.choice([1, 2]),
        'speed': random.randint(0, 30),
        'short_fuel_trim': 0.5 + random.uniform(-0.2, 0.2),
        'long_fuel_trim': 1.2 + random.uniform(-0.1, 0.1),
        'intake_pressure': 30 + random.randint(-2, 2),
        'timing_advance': 10 + random.uniform(-1, 1),
        'intake_temp': 35 + random.randint(-3, 3),
        'maf': 3.5 + random.uniform(-0.3, 0.3),
        'throttle': 15 + random.randint(-2, 2),
        'o2_voltage': 0.45 + random.uniform(-0.05, 0.05),
        'fuel_pressure': 50 + random.randint(-3, 3),
        'simulated': True
    }

def connect_to_real_elm():
    """محاولة الاتصال بجهاز ELM327 حقيقي عبر WiFi"""
    global real_elm_socket, connected, simulation_mode, device_name
    try:
        if real_elm_socket:
            real_elm_socket.close()
        
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)
        sock.connect((ELM327_IP, ELM327_PORT))
        
        # تهيئة الجهاز
        time.sleep(1)
        sock.send(b'ATZ\r\n')
        time.sleep(1)
        response = sock.recv(1024).decode().strip()
        print(f"رد ATZ: {response}")
        
        sock.send(b'ATE0\r\n')
        time.sleep(0.5)
        sock.recv(1024)
        
        # الحصول على اسم الجهاز (قد يكون من ATI أو من اسم الشبكة)
        sock.send(b'ATI\r\n')
        time.sleep(0.5)
        name_response = sock.recv(1024).decode().strip()
        # استخراج اسم الجهاز (عادةً يحتوي على ELM327)
        if name_response:
            device_name = name_response.split('\r\n')[0][:20]  # أول سطر كاسم
        else:
            device_name = "ELM327"
        
        real_elm_socket = sock
        connected = True
        simulation_mode = False
        print(f"✅ تم الاتصال بجهاز حقيقي: {device_name}")
        return True, device_name
    except Exception as e:
        print(f"❌ فشل الاتصال بالجهاز الحقيقي: {e}")
        connected = False
        simulation_mode = True
        device_name = None
        return False, None

def disconnect_from_real_elm():
    global real_elm_socket, connected, simulation_mode, device_name
    if real_elm_socket:
        real_elm_socket.close()
        real_elm_socket = None
    connected = False
    simulation_mode = True
    device_name = None
    print("🔴 تم قطع الاتصال بالجهاز الحقيقي")

# ===== نقاط نهاية Flask =====
@app.route('/api/connect', methods=['POST'])
def connect():
    global simulation_mode, connected, device_name
    # محاولة الاتصال بجهاز حقيقي
    success, name = connect_to_real_elm()
    if success:
        return jsonify({
            'status': 'connected',
            'deviceName': name,
            'mode': 'real'
        })
    else:
        # إذا فشل، نبقى في وضع المحاكاة
        simulation_mode = True
        connected = False
        device_name = None
        return jsonify({
            'status': 'simulation',
            'message': 'لا يوجد جهاز حقيقي، استخدام وضع المحاكاة'
        })

@app.route('/api/disconnect', methods=['POST'])
def disconnect():
    disconnect_from_real_elm()
    return jsonify({'status': 'disconnected'})

@app.route('/api/data')
def data_endpoint():
    global simulation_mode, connected
    if connected and not simulation_mode and real_elm_socket:
        # هنا يمكنك قراءة بيانات حقيقية إذا أردت، لكن سنبقيها محاكاة للتبسيط
        # يمكن إضافة دوال قراءة حقيقية لاحقاً
        data = generate_mock_data()
        data['simulated'] = False
        return jsonify(data)
    else:
        # وضع المحاكاة
        return jsonify(generate_mock_data())

@app.route('/api/dtc')
def dtc_endpoint():
    if connected and not simulation_mode:
        # هنا يمكن قراءة رموز حقيقية
        return jsonify(['P0101', 'P0135', 'P0171'])  # مؤقت
    else:
        return jsonify(['P0101', 'P0135', 'P0171'])

@app.route('/api/clear_dtc', methods=['POST'])
def clear_dtc_endpoint():
    if connected and not simulation_mode:
        # مسح حقيقي
        return jsonify({'status': 'cleared'})
    else:
        return jsonify({'status': 'cleared'})

if __name__ == '__main__':
    print("🚀 خدمة ELM327 جاهزة. وضع المحاكاة نشط افتراضياً.")
    print(f"   اضغط Connect للاتصال بجهاز حقيقي (IP: {ELM327_IP}:{ELM327_PORT})")
    app.run(host='0.0.0.0', port=5000, debug=True)
#include <Wire.h>
#include <FirebaseESP32.h>
#include <LiquidCrystal_PCF8574.h>
#include <VL53L0X.h>
#include <WiFi.h>
#include <time.h>

// datos del wifi ssid es el nombre de la red y pasword la contraseña
const char* ssid     = "redmaquina";
const char* password = "123456789";

// apartado de firebase aca van las credenciales para mandar todo
FirebaseData   fbdo;
FirebaseAuth   auth;
FirebaseConfig config;

const char* firebase_host   = "https://ensayos-a-compresion-default-rtdb.firebaseio.com/";
const char* firebase_apiKey = "AIzaSyCXOd-zp2wjey667nVwyPYV7MPPHEmUo2g";


#define PIN_TOMA_DATOS   15   // Interruptor
#define PIN_PESO         34   // Sensor de presión/fuerza
#define PIN_SDA_I2C      21
#define PIN_SCL_I2C      22


LiquidCrystal_PCF8574 lcd(0x27);
VL53L0X sensorDist;

// esto es basicamente un tope para que no se excedan las muestras
const int MAX_MUESTRAS = 5000;

// Parámetros del sensor de presión
const float VREF = 3.3;          // Voltaje de referencia del ESP32
const int ADC_RES = 4095;        // Resolución del ADC
const float MAX_PRESSURE = 1600.0; // Rango en psi
const float AREA_IN_SQ_INCHES = 1.0956; // Área pistón en pulgadas cuadradas

// Variables de calibración
float zeroVoltage = 0.0;

float fuerzaArr[MAX_MUESTRAS];
uint16_t distArr[MAX_MUESTRAS];
int idx         = 0;
bool colectando = false;

// Para guardar la hora de inicio del lote
String fechaHoraInicio;

// ntp para hora y fecha
const char* ntpServer = "pool.ntp.org";
const long  gmtOffset_sec = -21600; // UTC-6 (Guatemala)
const int   daylightOffset_sec = 0;


String obtenerFechaHora() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    return "NoTime";
  }
  char buffer[25];
  strftime(buffer, 25, "%Y-%m-%d %H:%M:%S", &timeinfo);
  return String(buffer);
}

float mapVoltageToPressure(float voltage) {
  if (voltage < zeroVoltage) voltage = zeroVoltage;
  return ((voltage - zeroVoltage) / (VREF - zeroVoltage)) * MAX_PRESSURE;
}


bool enviarConReintento(String path, float valor, bool esFloat) {
  const int MAX_REINTENTOS = 3;
  for (int i = 0; i < MAX_REINTENTOS; i++) {
    bool ok;
    if (esFloat) {
      ok = Firebase.setFloat(fbdo, path, valor);
    } else {
      ok = Firebase.setInt(fbdo, path, (int)valor);
    }

    if (ok) return true;

    Serial.println("⚠ Error enviando (" + String(i+1) + "): " + fbdo.errorReason());
    delay(500); // espera pequeñita antes de reintentar
  }
  return false;
}


void setup() {
  Serial.begin(115200);
  pinMode(PIN_TOMA_DATOS, INPUT_PULLUP);


  analogReadResolution(12);
  analogSetPinAttenuation(PIN_PESO, ADC_11db);

  Wire.begin(PIN_SDA_I2C, PIN_SCL_I2C);
  lcd.begin(16, 2);
  lcd.setBacklight(255);
  lcd.setCursor(0, 0);
  lcd.print("Iniciando...");


  lcd.clear();
  lcd.print("Calibrando...");
  delay(2000);

  long sum = 0;
  for (int i = 0; i < 100; i++) {
    sum += analogRead(PIN_PESO);
    delay(10);
  }
  int rawZero = sum / 100;
  zeroVoltage = (rawZero / (float)ADC_RES) * VREF;
  Serial.printf("Calibrado: RAW=%d | ZeroVoltage=%.3f V\n", rawZero, zeroVoltage);

  lcd.clear();
  lcd.print("Listo!");
  delay(1000);

  lcd.setCursor(0, 1);
  lcd.print("Conectando...");
  WiFi.begin(ssid, password);
  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 15000) {
    delay(300);
    lcd.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) {
    String ip = WiFi.localIP().toString();
    Serial.println("WiFi Conectado: " + ip);
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi OK");
    lcd.setCursor(0, 1);
    lcd.print(ip.substring(0, 16));
  } else {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi FAIL");
    Serial.println("❌ No se pudo conectar al WiFi");
    while (1) delay(10);
  }
  delay(2000);

  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);

  config.host = firebase_host;
  config.api_key = firebase_apiKey;

  if (!Firebase.signUp(&config, &auth, "", "")) {
    Serial.println("⚠ Error en signUp: " + fbdo.errorReason());
  } else {
    Serial.println("Auth OK");
  }

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Firebase OK");
  lcd.setCursor(0, 1);
  lcd.print("DB lista");
  Serial.println("Firebase inicializado");
  delay(2000);


  if (!sensorDist.init()) {
    Serial.println("❌ Error VL53L0X");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("VL53 FAIL");
    while (1) delay(10);
  }
  sensorDist.setMeasurementTimingBudget(20000);
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("VL53L0X OK");
  delay(1000);

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Listo!");
  lcd.setCursor(0, 1);
  lcd.print("Presione Btn");
}


void loop() {
  bool boton = (digitalRead(PIN_TOMA_DATOS) == LOW);


  if (boton && !colectando) {
    colectando = true;
    idx        = 0;
    fechaHoraInicio = obtenerFechaHora();

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Recolectando");
    lcd.setCursor(0, 1);
    lcd.print("Fuerza+Dist");
    Serial.println(">>> Inicio recoleccion: " + fechaHoraInicio);
    delay(200);
  }

  // Recolección de datos del esp32
  if (colectando && boton && idx < MAX_MUESTRAS) {
    const int N = 20;
    long suma = 0;
    for (int i = 0; i < N; i++) {
      suma += analogRead(PIN_PESO);
      delay(2);
    }
    int rawProm = suma / N;
    float voltage = (rawProm / (float)ADC_RES) * VREF;

    float pressurePsi = mapVoltageToPressure(voltage);
    float forceLbf = pressurePsi * AREA_IN_SQ_INCHES;
    uint16_t distMm = sensorDist.readRangeSingleMillimeters();

    fuerzaArr[idx] = forceLbf;
    distArr[idx]   = distMm;

    Serial.printf("Muestra %d: RAW=%d | Volt=%.3f V | Pres=%.2f psi | Fuerza=%.2f lbf, D=%d mm\n",
                  idx, rawProm, voltage, pressurePsi, forceLbf, distMm);

    idx++;
    delay(30); 
  }

  // ENvio para la base de datos
  if (colectando && !boton) {
    colectando = false;
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Enviando...");
    lcd.setCursor(0, 1);
    lcd.print("Espere");

    Serial.println(">>> Enviando datos a Firebase...");

    Firebase.deleteNode(fbdo, "/datos");
    Firebase.setString(fbdo, "/datos/fecha_hora_inicio", fechaHoraInicio);

    for (int i = 0; i < idx; i++) {
      String pathBase = "/datos/muestras/" + String(i);

      if (!enviarConReintento(pathBase + "/fuerza_lbf", fuerzaArr[i], true)) {
        Serial.println("❌ Error fuerza idx=" + String(i));
      }
      if (!enviarConReintento(pathBase + "/dist_mm", distArr[i], false)) {
        Serial.println("❌ Error dist idx=" + String(i));
      }
    }

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Envio OK");
    lcd.setCursor(0, 1);
    lcd.print("Datos guardados");
    Serial.println(">>> Datos enviados correctamente");
    delay(3000);

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Listo!");
    lcd.setCursor(0, 1);
    lcd.print("Presione Btn");
  }
}

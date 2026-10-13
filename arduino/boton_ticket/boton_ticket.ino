const int PIN_BTN = 2;
const int PIN_LED = 8;
const int PIN_BUZZER = 9;

int pendientes = 0;
int pendientesPrev = 0;
bool estadoPrev = HIGH;
unsigned long ultimoCambio = 0;
unsigned long ultimoBlink = 0;
bool ledOn = false;
String buffer = "";

void setup() {
  Serial.begin(9600);
  pinMode(PIN_BTN, INPUT_PULLUP);
  pinMode(PIN_LED, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
}

void beep(int veces) {
  for (int i = 0; i < veces; i++) {
    digitalWrite(PIN_BUZZER, HIGH);
    delay(120);
    digitalWrite(PIN_BUZZER, LOW);
    delay(120);
  }
}

void loop() {
  // 1) Botón con antirrebote
  bool estado = digitalRead(PIN_BTN);
  if (estado != estadoPrev && millis() - ultimoCambio > 50) {
    ultimoCambio = millis();
    estadoPrev = estado;
    if (estado == LOW) Serial.println("BTN");
  }

  // 2) Mensajes de la notebook: "P:<cantidad>"
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n') {
      if (buffer.startsWith("P:")) {
        pendientes = buffer.substring(2).toInt();
        if (pendientes > pendientesPrev) beep(2);  // llegó un pedido nuevo
        pendientesPrev = pendientes;
      }
      buffer = "";
    } else if (c != '\r') {
      buffer += c;
    }
  }

  // 3) LED: parpadea si hay pedidos pendientes, apagado si no
  if (pendientes > 0) {
    if (millis() - ultimoBlink > 400) {
      ultimoBlink = millis();
      ledOn = !ledOn;
      digitalWrite(PIN_LED, ledOn);
    }
  } else {
    digitalWrite(PIN_LED, LOW);
  }
}
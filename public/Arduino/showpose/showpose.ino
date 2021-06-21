#include <Servo.h>
#include <Funken.h>
#include <AFMotor.h>


Funken fnk;

Servo servoRight;
Servo servoLeft;

AF_DCMotor motor1(1);
AF_DCMotor motor2(2);

int servoRightValue = 0;
int servoLeftValue = 0;

int motor1Value = 0;
int motor2Value = 0;

const int ledPin = 2;
int ledValue = 0;



void setup() {
    // init funken
  fnk.begin(57600, 0, 0); // higher baudrate for better performance
  fnk.listenTo("SHOWPOSE", showPose); // however you want to name your callback

  servoRight.attach(10);   //Servo1
  servoLeft.attach(9);    //Servo2

  motor1.run(FORWARD);
  motor2.run(FORWARD);

}

void loop() {
  // needed to make FUNKEN work
  fnk.hark();

}

void showPose(char *c) {

  // get first argument
  char *token = fnk.getToken(c); // is needed for library to work properly, but can be ignored
  
  int servoRightValue = atoi(fnk.getArgument(c));
  int servoLeftValue = atoi(fnk.getArgument(c));

  int motor1Value = atoi(fnk.getArgument(c));
  int motor2Value = atoi(fnk.getArgument(c));

  int ledValue = atoi(fnk.getArgument(c));

  servoRight.write(servoRightValue);
  servoLeft.write(servoLeftValue);

  motor1.setSpeed(motor1Value);
  motor2.setSpeed(motor2Value);

  if (ledValue == 1) {
    analogWrite(ledPin, 255);
    delay(500);
    analogWrite(ledPin, 0);
  } else {
    analogWrite(ledPin, 0);
  }
  
}

//roomId
var room = "default";

// knn-labels
let poseLabel = ["hands-up", "right-hand-up", "left-hand-up", "hands-down"];
let poseCount = [0, 0, 0, 0];

// webcam
let video;

// poseNet
let poseNet;
let poses = [];

// Create a KNN classifier
const knnClassifier = ml5.KNNClassifier();
let inputData = []; // get values in 'gotResultModel'
let predictions = [];
let mostPredictedClass = "";
let valueMostPredictedClass = 0.0;

// Global variable to store the classifier
let audioClassifier; //classifier in original

// Label
let predictedAudio = "loading...";
let audioLabel = [
  "hands-up",
  "right-hand-up",
  "left-hand-up",
  "hands-down",
  "simon-says",
];

// Teachable Machine model URL
// for sound model absolute path is needed!
const absolutePath = location.href.substr(
  0,
  location.href.lastIndexOf("/") + 1
);
let soundModel = absolutePath + "data/";

//game variables
let start = false;
let expectedPose; //is changed if the audio is a accepted command
let pointsP1 = 4;
let pointsP2 = 4;
let isSimonSays = false; //checks if the command is simon says and the next command has to be done or not
let waitingForAudio = true; //checks if the program is waiting for audio or posenet
let expectedPlayer = 1;
let showPlayer = 2;
let winner;

let playerNumber = 1;
let seconds = 5;
let timeStamp;
let skeletonData = [];
let x;
let y;
let count = 0;

//color variables
let fontcolor;
let blue;
let lightblue;
let pink;
let lightpink;
let led;
let bg;

//arduino
let serialController;

//heart images
let imgHeartGreen;
let imgHeartPink;

//speechbubble images
let imgSpeechbubbleGreen;
let imgSpeechbubblePink;

function preload() {
  // Load the model
  audioClassifier = ml5.soundClassifier(soundModel + "model.json");

  imgHeartGreen = loadImage("images/heart green.png");
  imgHeartPink = loadImage("images/heart rosa.png");
  imgSpeechbubbleGreen = loadImage("images/speechbubble green.png");
  imgSpeechbubblePink = loadImage("images/speechbubble rosa.png");
}

const sum = (accumulator, currentValue) => accumulator + currentValue;
const indexOfMax = function (array) {
  let maxNumber = Math.max(...array); //spreadoperator
  for (let i = 0; i < array.length; i++) {
    if (array[i] == maxNumber) {
      return i;
    }
  }
  return undefined;
};

function setup() {
  // canvas
  const canvas = createCanvas(640, 480);
  canvas.parent("canvas");

  serialController = new SerialController(57600);

  // generate gui
  generateGui(poseLabel);

  // init webcam
  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide();

  poseNet = ml5.poseNet(
    video,
    {
      flipHorizontal: true,
      detectionType: "single",
    },
    modelReady
  );

  //start audio
  audioClassifier.classify(gotResult);
  predictedAudio = "loading...";

  // detect if new pose detected and call 'gotResultModel'
  poseNet.on("pose", gotResultsModel);
  loadKNN();
  //arduino start
  initSerial();

  //set variables to null
  expectedPose = "hands-down";
  isSimonSays = false;
  waitingForAudio = true;
  seconds = 5;

  fontcolor = color("#585858");
  //player 1
  blue = color("#a8e6cf");
  lightblue = color("#eff7e3");
  //player 2
  pink = color("#ffaaa5");
  lightpink = color("#f5e3d7");
  //right
  green = color("#A4F58A");
  //wrong
  red = color("#FB554E");
  //led
  led = color("#7E96F6");
  bg = lightblue;

  //connect to server
  socket = io.connect();

  socket.on("connect", function () {
    socket.emit("room", room);
  });

  socket.on("player", function (n) {
    if (n == 1) {
      playerNumber = 2;
      document.body.style.backgroundColor = lightpink;
      console.log(document.body.style.backgroundColor);
      document
        .querySelectorAll("button")
        .forEach((el) => el.classList.add("playerTwo"));
    }
    document.getElementById("playerNumber").innerText =
      "You are Player " + playerNumber;
    console.log("playern: " + playerNumber);
  });

  socket.on("message", function (data) {
    console.log("Incoming message:", data);
  });

  socket.on("command", function (data) {
    isSimonSays = data.isSimonSays;
    expectedPlayer = data.expectedPlayer;
    expectedPose = data.expectedPose;
    waitingForAudio = data.waitingForAudio;
    timeStamp = data.timeStamp;
    seconds = data.seconds;

    if (expectedPose.includes('up')) {
      handsUp();
    } else if (expectedPose.includes('right')) {
      rightHandUp();
    } else if (expectedPose.includes('left')) {
      leftHandUp();
    } else {
      handsDown();
    }
    console.log("added command data");
  });

  socket.on("startGame", startGame);

  socket.on("sendImage", function (image) {
    video = image;
  });

  socket.on("sendResults", function (data) {
    waitingForAudio = data.waitingForAudio;
    expectedPose = data.expectedPose;
    expectedPlayer = data.expectedPlayer;
    isSimonSays = data.isSimonSays;
    poseCount = data.poseCount;
    pointsP1 = data.pointsP1;
    pointsP2 = data.pointsP2;
    showPlayer = data.showPlayer;
    count = data.count;
    if (data.color == "green") {
      bg = green;
    } else {
      bg = red;
    }
    console.log("added results of poseCheck");
  });

  socket.on("keyPoints", function (datax, datay) {
    x = datax;
    y = datay;
  });

  socket.on("skeleton", function (data) {
    skeletonData = [];
    for (let i = 0; i < data.length; i++) {
      let ax = data[i].ax;
      let ay = data[i].ay;
      let bx = data[i].bx;
      let by = data[i].by;

      skeletonData[i] = [ax, ay, bx, by];
    }
  });

  socket.on("countdown", function (sec) {
    seconds = sec;
  });

  socket.on("gameOver", function (stats) {
    start = stats.start;
    count = stats.count;
    winner = stats.winner;
    if (stats.color == "green") {
      bg = green;
    } else {
      bg = red;
    }
  });
}

function startGame() {
  console.log("startGame");
  start = true;
  poseCount = [0, 0, 0, 0];
  poses = [];
  winner = undefined;

  inputData = []; // get values in 'gotResultModel'
  predictions = [];
  mostPredictedClass = "";
  valueMostPredictedClass = 0.0;

  predictedAudio = "loading...";

  expectedPose = "hands-down"; //is changed if the audio is a accepted command
  pointsP1 = 4;
  pointsP2 = 4;
  isSimonSays = false;
  waitingForAudio = true;
  playerOne = true;

  bg = lightblue;
}

function joinRoom() {
  room = document.getElementById("roomId").value;
  socket.emit("room", room);
  socket.emit("player", room, playerNumber);
  startGame();
  start = false;
  initSerial();
}

function sendMsg() {
  msg = document.getElementById("chatMsg").value;
  socket.emit("message", room, msg);
}

function draw() {
  if (count > 0) {
    count--;
  } else if (showPlayer == 1) {
    bg = lightblue;
  } else {
    bg = lightpink;
  }
  background(bg);
  strokeWeight(1);

  if (start) {
    if (waitingForAudio) {
      if (playerNumber == expectedPlayer) {
        //enableButtons();
        //getAudio();
        getCommand();
      } else {
        fill(fontcolor);
        strokeWeight(1);
        textAlign(CENTER, CENTER);
        textSize(40);
        text("Waiting for other player.", width / 2, height - 50);
      }
    } else {
      fill(fontcolor);
      textAlign(CENTER, CENTER);
      textSize(40);
      if (playerNumber == expectedPlayer) {
        if (poseCount.reduce(sum) < 20) {
          classify();
          if (seconds > 0) {
            countdown();
          } else {
            getPoseNet();
          }
        } else {
          seconds = 5;
          checkPose();
        }
      } else {
        //disableButtons();
      }
    }
    if (playerNumber == showPlayer) {
      drawKeypoints();
      drawSkeleton();
    }
    showKeypoints();
    showSkeleton();
    showPlayerStats();
    //show countdown
    if (seconds < 5 && seconds != 0) {
      strokeWeight(1);
      fill(fontcolor);
      textSize(100);
      text(seconds, width / 2, height / 2);
    }
  } else {
    fill(fontcolor);
    textSize(30);
    textAlign(CENTER, CENTER);
    if (winner != undefined) {
      text("Player " + winner + " won!", width / 2, height / 2);
    } else {
      text("Join a room and start the game!\nYou are Player " + playerNumber, width / 2, height / 2);
    }
  }
}

//AUDIO-CLASSIFIER
/*function getAudio() {
  seconds = 5;
  fill(fontcolor);
  strokeWeight(1);
  textSize(16);
  textAlign(CENTER, CENTER);
  text(predictedAudio, width / 2, (height / 3) * 2);

  //is it simon says?
  if (predictedAudio == "simon-says") {
    isSimonSays = true;
  } else {
    //next command
    for (let i = 0; i < audioLabel.length; i++) {
      if (predictedAudio == audioLabel[i] && predictedAudio != "simon-says") {
        sendCommand(predictedAudio);
      }
    }
  }
}*/

// The model recognizing a sound will trigger this event
function gotResult(error, results) {
  if (error) {
    console.error(error);
    return;
  }
  predictedAudio = results[0].label;
}

function getCommand() {
  let x = width / 6;
  let y = height - height / 4 - 10;
  let w = width/6;
  let h = height/6;

  let lx = x - w/3;
  let ly = y + h/2 + 2;
  let lx2 = x - w/3 + w/2
  let lw = w/4;
  let lhleft = h/3*2;
  let lhright = h/3*2;

  let rectW = w/2;

  strokeWeight(3);
  //ellipse as buttons
  (expectedPlayer == 1) ? fill(lightblue) : fill(lightpink);
  if (mouseX > (lx - 40) && mouseX < (lx -20) && mouseY > (ly - 10) && mouseY < (ly + 10) ) {
    (expectedPlayer == 1) ? fill(blue) : fill(pink);
  } 
  ellipse(lx - 30, ly, 20, 20);
  (expectedPlayer == 1) ? fill(lightblue) : fill(lightpink);
  if (mouseX > (lx + rectW + 20) && mouseX < (lx + rectW + 40)&& mouseY > (ly - 10) && mouseY < (ly + 10) ) {
    (expectedPlayer == 1) ? fill(blue) : fill(pink);
  }
  ellipse(lx + rectW + 30, ly, 20, 20);

  
  if (expectedPose == "left-hand" || expectedPose == "hands-up") {
    lhleft = -h/3*2;
  } 
  if (expectedPose == "right-hand" || expectedPose == "hands-up") {
    lhright = -h/3*2;
  }
  line(lx, ly, lx - lw, ly + lhleft);
  line(lx2, ly, lx2 + lw, ly + lhright);

  (expectedPlayer == 1) ? fill(blue) : fill(pink);
  rectMode(CORNER);
  rect(x - w/3, y + h/2, rectW, h);

  fill(fontcolor);
  textSize(10);
  strokeWeight(1);
  if (expectedPlayer == 1) {
    image(imgSpeechbubbleGreen, x, y, w, h);
  } else {
    //TODO: Sprechblase Lena grau
    image(imgSpeechbubblePink, x, y, w, h);
  }
  text("SIMON SAYS", x-10, y);
  
  (expectedPlayer == 1) ? fill(lightblue) : fill(lightpink);
  if (mouseX > (width - x- 40) && mouseX < (width - x + 40) && mouseY > (height - 50) && mouseY < (height - 30) ) {
    (expectedPlayer == 1) ? fill(blue) : fill(pink);
  }
  rectMode(CENTER);
  rect(width - x , height - 40, w, 20, 20);
  fill(fontcolor);
  text("SEND TO FRIEND ->", width - x , height - 40);
  if(!isSimonSays) {
    strokeWeight(3);
    line(x - w/3, y, x + w/5, y);
  } else {
    fill(led);
  }
  strokeWeight(1);
  ellipse(x - 30, y - 15, 5, 5);

  
}

function mouseClicked() {
  //copies from getCommand!
  let x = width / 6;
  let y = height - height / 4 - 10;
  let w = width/6;
  let h = height/6;

  strokeWeight(3);
  let lx = x - w/3;
  let ly = y + h/2 + 2;

  let rectW = w/2;
  //arms movement
  if (mouseX > (lx - 40) && mouseX < (lx -20) && mouseY > (ly - 10) && mouseY < (ly + 10) ) {
    if (expectedPose == "hands-down") {
      expectedPose = "left-hand";
    } else if (expectedPose == "left-hand") {
      expectedPose = "hands-down";
    } else if (expectedPose == "right-hand") {
      expectedPose = "hands-up";
    } else {
      expectedPose = "right-hand";
    }
    console.log("click", mouseX-lx);
    console.log("pose:", expectedPose);
  } else if (mouseX > (lx + rectW + 20) && mouseX < (lx + rectW + 40)&& mouseY > (ly - 10) && mouseY < (ly + 10) ) {
    if (expectedPose == "hands-down") {
      expectedPose = "right-hand";
    } else if (expectedPose == "left-hand") {
      expectedPose = "hands-up";
    } else if (expectedPose == "right-hand") {
      expectedPose = "hands-down";
    } else {
      expectedPose = "left-hand";
    }
    console.log("click: ", mouseX-lx-rectW);
    console.log("pose:", expectedPose);
  }

  //speech bubble for simon says
  if (mouseX > (x - w/2) && mouseX < (x + w/2) && mouseY > (y - h/2) && mouseY < (y + h/2) ) {
    isSimonSays = !isSimonSays;
  }

  //submit button iwht text send to friend
  if (mouseX > (width - x- 40) && mouseX < (width - x + 40) && mouseY > (height - 50) && mouseY < (height - 30) ) {
    sendCommand();
  }
}

//MULTIPLAYER
function sendCommand() {
  if (expectedPlayer == 1) {
    expectedPlayer = 2;
  } else {
    expectedPlayer = 1;
  }
  waitingForAudio = false;
  timeStamp = millis();
  seconds = 5;
  var data = {
    isSimonSays: isSimonSays,
    expectedPlayer: expectedPlayer,
    expectedPose: expectedPose,
    waitingForAudio: waitingForAudio,
    timeStamp: timeStamp,
    seconds: seconds,
  };

  console.log("send", expectedPose, isSimonSays);
  socket.emit("command", room, data);
}

function showPlayerStats() {
  let p = "Player 1";
  if (expectedPlayer != 1) {
    p = "Player 2";
    image(imgSpeechbubblePink, width / 11 + 100, height / 8 - 15, 25, 20);
  } else {
    image(imgSpeechbubbleGreen, (width / 6) * 5 + 52, height / 8 - 15, 25, 20);
  }

  fill(fontcolor);
  strokeWeight(1);
  textSize(16);
  textAlign(CENTER, CENTER);
  text(p, width / 2, 50);

  textSize(12);
  //TODO: Lena stattdessen hier die Herzen einfügen je nach anzahl pointsP1 / pointsP2
  //Lifes Player One
  if (pointsP1 == 5) {
    image(imgHeartGreen, width / 11, height / 8 + 5, 25, 20);
    image(imgHeartGreen, width / 11 + 20, height / 8 + 5, 25, 20);
    image(imgHeartGreen, width / 11 + 40, height / 8 + 5, 25, 20);
    image(imgHeartGreen, width / 11 + 60, height / 8 + 5, 25, 20);
    image(imgHeartGreen, width / 11 + 80, height / 8 + 5, 25, 20);
    image(imgHeartGreen, width / 11 + 100, height / 8 + 5, 25, 20);
  } else if (pointsP1 == 4) {
    image(imgHeartGreen, width / 11, height / 8 + 5, 25, 20);
    image(imgHeartGreen, width / 11 + 20, height / 8 + 5, 25, 20);
    image(imgHeartGreen, width / 11 + 40, height / 8 + 5, 25, 20);
    image(imgHeartGreen, width / 11 + 60, height / 8 + 5, 25, 20);
    image(imgHeartGreen, width / 11 + 80, height / 8 + 5, 25, 20);
  } else if (pointsP1 == 3) {
    image(imgHeartGreen, width / 11, height / 8 + 5, 25, 20);
    image(imgHeartGreen, width / 11 + 20, height / 8 + 5, 25, 20);
    image(imgHeartGreen, width / 11 + 40, height / 8 + 5, 25, 20);
    image(imgHeartGreen, width / 11 + 60, height / 8 + 5, 25, 20);
  } else if (pointsP1 == 2) {
    image(imgHeartGreen, width / 11, height / 8 + 5, 25, 20);
    image(imgHeartGreen, width / 11 + 20, height / 8 + 5, 25, 20);
    image(imgHeartGreen, width / 11 + 40, height / 8 + 5, 25, 20);
  } else if (pointsP1 == 1) {
    image(imgHeartGreen, width / 11, height / 8 + 5, 25, 20);
    image(imgHeartGreen, width / 11 + 20, height / 8 + 5, 25, 20);
  } else if (pointsP1 == 0) {
    image(imgHeartGreen, width / 11, height / 8 + 5, 25, 20);
  }

  //Lifes Player Two
  if (pointsP2 == 5) {
    image(imgHeartPink, (width / 6) * 5 - 48, height / 8 + 5, 25, 20);
    image(imgHeartPink, (width / 6) * 5 - 28, height / 8 + 5, 25, 20);
    image(imgHeartPink, (width / 6) * 5 - 08, height / 8 + 5, 25, 20);
    image(imgHeartPink, (width / 6) * 5 + 12, height / 8 + 5, 25, 20);
    image(imgHeartPink, (width / 6) * 5 + 32, height / 8 + 5, 25, 20);
    image(imgHeartPink, (width / 6) * 5 + 52, height / 8 + 5, 25, 20);
  } else if (pointsP2 == 4) {
    image(imgHeartPink, (width / 6) * 5 - 48, height / 8 + 5, 25, 20);
    image(imgHeartPink, (width / 6) * 5 - 28, height / 8 + 5, 25, 20);
    image(imgHeartPink, (width / 6) * 5 - 08, height / 8 + 5, 25, 20);
    image(imgHeartPink, (width / 6) * 5 + 12, height / 8 + 5, 25, 20);
    image(imgHeartPink, (width / 6) * 5 + 32, height / 8 + 5, 25, 20);
  } else if (pointsP2 == 3) {
    image(imgHeartPink, (width / 6) * 5 - 48, height / 8 + 5, 25, 20);
    image(imgHeartPink, (width / 6) * 5 - 28, height / 8 + 5, 25, 20);
    image(imgHeartPink, (width / 6) * 5 - 08, height / 8 + 5, 25, 20);
    image(imgHeartPink, (width / 6) * 5 + 12, height / 8 + 5, 25, 20);
  } else if (pointsP2 == 2) {
    image(imgHeartPink, (width / 6) * 5 - 48, height / 8 + 5, 25, 20);
    image(imgHeartPink, (width / 6) * 5 - 28, height / 8 + 5, 25, 20);
    image(imgHeartPink, (width / 6) * 5 - 08, height / 8 + 5, 25, 20);
  } else if (pointsP2 == 1) {
    image(imgHeartPink, (width / 6) * 5 - 48, height / 8 + 5, 25, 20);
    image(imgHeartPink, (width / 6) * 5 - 28, height / 8 + 5, 25, 20);
  } else if (pointsP2 == 0) {
    image(imgHeartPink, (width / 6) * 5 - 48, height / 8 + 5, 25, 20);
  }

  text("Lifes Player 1: ", width / 6, height / 10);
  text("Lifes Player 2: ", (width / 6) * 5, height / 10);

  noFill();
  strokeWeight(2);
  rectMode(CENTER);
  rect(width / 2, 50, 80, 20);
}

function countdown() {
  let s = (millis() - timeStamp) / 1000;
  if (s > 1) {
    seconds--;
    timeStamp = millis();
  }
  socket.emit("countdown", room, seconds);
}

//POSENET
function getPoseNet() {
  // show predictions KNN classification
  if (predictions.length > 0) {
    // loop through labels
    for (let i = 0; i < poseLabel.length; i++) {
      if (mostPredictedClass == poseLabel[i]) {
        poseCount[i]++;
      }
    }
  }
}

function checkPose() {
  //get the pose which was most often showed
  let i = indexOfMax(poseCount); //spread-operator
  let pose = poseLabel[i];
  textSize(30);
  text("your pose: " + poseLabel[i], width / 2, height - 20);

  /*console.log("expected pose: " + expectedPose);
  console.log("simon: " + isSimonSays);
  console.log("your pose: " + poseLabel[i]);*/

  let color;
  ellipseMode(CENTER);
  if (isSimonSays && pose == expectedPose) {
    color = "green";
    bg = green;
    /*right: nothing happens
    if (expectedPlayer == 1) {
      pointsP1++;
    } else {
      pointsP2++;
    }*/
    count = 20;
  } else if (!isSimonSays && pose == "hands-down") {
    color = "green";
    bg = green;
    /*if (expectedPlayer == 1) {
      pointsP1++;
    } else {
      pointsP2++;
    }*/
    count = 20;
  } else {
    color = "red";
    bg = red;
    count = 20;
    if (expectedPlayer == 1) {
      pointsP1--;
      if (pointsP1 <= 0) {
        start = false;
        count = 500;
        winner = 2;
        let stats = {
          start: start,
          count: count,
          winner: winner,
          color: color,
        };
        socket.emit("gameOver", room, stats);
      }
    } else {
      pointsP2--;
      if (pointsP2 <= 0) {
        start = false;
        count = 500;
        winner = 1;
        let stats = {
          start: start,
          count: count,
          winner: winner,
          color: color,
        };
        socket.emit("gameOver", room, stats);
      }
    }
  }
  console.log("expected player: " + expectedPlayer);

  if (showPlayer == 1) {
    showPlayer = 2;
  } else {
    showPlayer = 1;
  }
  waitingForAudio = true;
  expectedPose = "hands-down";
  isSimonSays = false;
  poseCount = [0, 0, 0, 0];
  var data = {
    waitingForAudio: waitingForAudio,
    expectedPose: expectedPose,
    expectedPlayer: expectedPlayer,
    isSimonSays: isSimonSays,
    poseCount: poseCount,
    pointsP1: pointsP1,
    pointsP2: pointsP2,
    showPlayer: showPlayer,
    count: count,
    color: color,
  };
  socket.emit("sendResults", room, data);
}

// model ready
function modelReady() {
  //select('#output').html('model loaded');
}

// results of current model
function gotResultsModel(result) {
  poses = result;
  if (poses.length > 0) {
    inputData = poses[0].pose.keypoints.map((p) => [
      p.score,
      p.position.x,
      p.position.y,
    ]);
  }
}

function drawKeypoints() {
  // loop through all the poses detected
  for (let i = 0; i < poses.length; i++) {
    // for each pose detected, loop through all the keypoints
    let pose = poses[i].pose;
    let keypoint = pose.keypoints[0];
    x = keypoint.position.x;
    y = keypoint.position.y;
    socket.emit("keyPoints", room, x, y);
  }
}

function showKeypoints() {
  noStroke();
  //TODO: Lena Sprechblase hier einfügen
  /* fill(255);
  ellipse(x, y, 200, 200); */
  imageMode(CENTER);
  if (expectedPlayer == 1) {
    image(imgSpeechbubbleGreen, x + 50, y, 350, 300);
  } else {
    image(imgSpeechbubblePink, x + 50, y, 350, 300);
  }
}

function drawSkeleton() {
  let data = [];
  for (let i = 0; i < poses.length; i++) {
    let skeleton = poses[i].skeleton;
    // for every skeleton, loop through all body connections
    for (let j = 0; j < skeleton.length; j++) {
      let partA = skeleton[j][0];
      let partB = skeleton[j][1];
      strokeWeight(10);
      stroke(fontcolor);
      line(
        partA.position.x,
        partA.position.y,
        partB.position.x,
        partB.position.y
      );
      let part = {
        ax: partA.position.x,
        ay: partA.position.y,
        bx: partB.position.x,
        by: partB.position.y,
      };
      data.push(part);
    }
  }
  socket.emit("skeleton", room, data);
}

function showSkeleton() {
  stroke(fontcolor);
  strokeWeight(10);
  for (let i = 0; i < skeletonData.length; i++) {
    line(
      skeletonData[i][0],
      skeletonData[i][1],
      skeletonData[i][2],
      skeletonData[i][3]
    );
  }
  skeletonData = [];
}

// Add the current input data to the classifier
function addExample(poseLabel) {
  // Add an example (= input data) with a label to the classifier
  if (inputData.length > 0) {
    knnClassifier.addExample(inputData, poseLabel);
  }

  // update counts
  updateCounts();
}

// Predict the current pose.
function classify() {
  // if there are no labels through error and return
  if (knnClassifier.getNumLabels() <= 0) {
    console.error("There is no examples in any label");
    return;
  }

  // Use knnClassifier to classify which label do these features belong to
  if (inputData.length > 0) {
    knnClassifier.classify(inputData, gotResultsPoseNet);
  }
}

// Show the results
function gotResultsPoseNet(err, result) {
  // Display any error
  if (err) {
    console.error(err);
  }

  if (result.confidencesByLabel) {
    const confidences = result.confidencesByLabel; // array object

    // get key/label highest values and its value
    let keyHighestValue = Object.keys(confidences).reduce((a, b) =>
      confidences[a] > confidences[b] ? a : b
    );
    mostPredictedClass = keyHighestValue;
    valueMostPredictedClass = confidences[keyHighestValue];

    // get confidence for each class
    for (let i = 0; i < poseLabel.length; i++) {
      let confidence = confidences[poseLabel[i]];
      predictions[i] = confidence;
    }
  }

  // classify again
  classify();
}

// Save dataset as myKNNDataset.json
function saveKNN() {
  knnClassifier.save("myKNNDataset");
}

// Load dataset to the classifier
function loadKNN() {
  knnClassifier.load("data/myKNNDataset.json", updateCounts);
}

// Update the example count for each label
function updateCounts() {
  const counts = knnClassifier.getCountByLabel();

  for (let i = 0; i < poseLabel.length; i++) {
    //select('#counter_' + poseLabel[i]).html(counts[poseLabel[i]] || 0);
  }
}

// Clear the examples in one label
function clearLabel(classLabel) {
  if (knnClassifier.getNumLabels() <= 0) {
    console.error("There is no examples in any label");
    return;
  }
  knnClassifier.clearLabel(classLabel);
  updateCounts();
}

// Clear all the examples in all labels
function clearAllLabels() {
  if (knnClassifier.getNumLabels() <= 0) {
    console.error("There is no examples in any label");
    return;
  }
  knnClassifier.clearAllLabels();
  updateCounts();
}

function generateGui(lc) {
  // main gui
  /*const gui_main = createDiv().parent("gui");

  //for debugging purposes
  const simonSaysButton = createButton("Simon Says").parent(gui_main);
  simonSaysButton.class("button");
  simonSaysButton.id("simon-button");
  document.getElementById("simon-button").disabled = true;
  simonSaysButton.mousePressed(function () {
    console.log("SIMON");
    isSimonSays = true;
  });

  const rightHandUpButton = createButton("Right hand up").parent(gui_main);
  rightHandUpButton.class("button");
  rightHandUpButton.id("right-button");
  document.getElementById("right-button").disabled = true;
  rightHandUpButton.mousePressed(function () {
    waitingForAudio = false;
    sendCommand("right-hand-up");
  });

  const leftHandUpButton = createButton("Left hand up").parent(gui_main);
  leftHandUpButton.class("button");
  leftHandUpButton.id("left-button");
  document.getElementById("left-button").disabled = true;
  leftHandUpButton.mousePressed(function () {
    waitingForAudio = false;
    sendCommand("left-hand-up");
  });

  const bothHandsUpButton = createButton("Both hands up").parent(gui_main);
  bothHandsUpButton.class("button");
  bothHandsUpButton.id("up-button");
  document.getElementById("up-button").disabled = true;
  bothHandsUpButton.mousePressed(function () {
    waitingForAudio = false;
    sendCommand("hands-up");
  });

  const bothHandsDownButton = createButton("Both hands down").parent(gui_main);
  bothHandsDownButton.class("button");
  bothHandsDownButton.id("down-button");
  document.getElementById("down-button").disabled = true;
  bothHandsDownButton.mousePressed(function () {
    waitingForAudio = false;
    sendCommand("hands-down");
  });*/
}

/*function enableButtons() {
  document.getElementById("down-button").disabled = false;
  document.getElementById("up-button").disabled = false;
  document.getElementById("left-button").disabled = false;
  document.getElementById("right-button").disabled = false;
  document.getElementById("simon-button").disabled = false;
}

function disableButtons() {
  document.getElementById("down-button").disabled = true;
  document.getElementById("up-button").disabled = true;
  document.getElementById("left-button").disabled = true;
  document.getElementById("right-button").disabled = true;
  document.getElementById("simon-button").disabled = true;
}*/

//Arduino
function initSerial() {
  serialController.init();
}

function leftHandUp() {
  let left = 50;
  let right = 60;
  let led = 0;
  if (isSimonSays) {
    led = 1;
  }
  sendToArduino(right, left, 0, 0, led);
}

function rightHandUp() {
  let right = 0;
  let left = 0;
  let led = 0;
  if (isSimonSays) {
    led = 1;
  }
  sendToArduino(right, left, 0, 0, led);
}

function handsUp() {
  let left = 0;
  let right = 60;
  let led = 0;
  if (isSimonSays) {
    led = 1;
  }
  sendToArduino(right, left, 0, 0, led);
}

function handsDown() {
  let left = 50;
  let right = 0;
  let led = 0;
  if (isSimonSays) {
    led = 1;
  }
  sendToArduino(right, left, 0, 0, led);
}

function sendToArduino(right, left, motor1, motor2, led) {
  serialController.write("SHOWPOSE");
  serialController.write(" ");
  serialController.write(str(right));
  serialController.write(" ");
  serialController.write(str(left));
  serialController.write(" ");
  serialController.write(motor1);
  serialController.write(" ");
  serialController.write(motor2);
  serialController.write(" ");
  serialController.write(led);
  serialController.write("\r\n");
}

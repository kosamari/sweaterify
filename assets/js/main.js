var color1 = '#FCFBE3';
var color2 = '#d42426';
var dip = 1.25;
var sWidth = 3.75;
var sHeight = 5.25;
var wGuage = 160;
var hGuage = 160;
var imgWidth,imgHeight;
var oneBitImg;
var offsetX = 0;
var offsetY = 0;
var reader = new FileReader();
var img = new Image();
var fileInput = document.getElementById('file');

var canvas = document.getElementById('canvas');
var ctx = canvas.getContext('2d');
canvas.width = wGuage*sWidth+180;
canvas.height = hGuage*(sHeight-dip)+30;
drawParts();

fileInput.addEventListener('change', function(e) {
  reader.readAsDataURL(e.target.files[0]);
  reader.onload = function() {
    img.src = reader.result;
    img.addEventListener('load', main, false);
  };
}, false);

/* position controller */
var up = document.getElementById('up');
var down = document.getElementById('down');
var left = document.getElementById('left');
var right = document.getElementById('right');
up.addEventListener('click', function(e) {
  offsetY--;
  redrawBody();
});
down.addEventListener('click', function(e) {
  offsetY++;
  redrawBody();
});
left.addEventListener('click', function(e) {
  offsetX--;
  redrawBody();
});
right.addEventListener('click', function(e) {
  offsetX++;
  redrawBody();
});

function setCol1(col){
  color1 = '#' + col;
  redrawAll();
}
function setCol2(col){
  color2 = '#' + col;
  redrawAll();
}

function main(){
  imgWidth = wGuage;
  imgHeight = hGuage * (img.height/img.width);
  offsetX = 0;
  offsetY = 0;
  var download = document.getElementById('download')
  download.style.backgroundColor='orange';

  var canvas = document.getElementById('original');
      canvas.width = imgWidth;
      canvas.height = imgHeight;
  var context = canvas.getContext('2d');
      context.drawImage(img, 0, 0, imgWidth, imgHeight);

  //create oneBitImage array used by drawSts();
  oneBitImg = dither(context.getImageData(0,0,imgWidth,imgHeight).data);
  drawSts();
}

document.getElementById('download').addEventListener('click', function() {
  download(this, 'canvas', 'sweaterify.png');
}, false);

function download(link, canvasId, filename){
  link.href = document.getElementById(canvasId).toDataURL();
  link.download = filename;
}
/* Redraw functions */
function redrawAll(){
  console.log(color2)
  drawParts();
  drawSts();
}

function redrawBody(){
  drawSts();
}

/* Dithering function */
function dither(imageData, ditherMatrix){
  function makeImageMap(arr){
    var map = [];
    var pixels = new Array(arr.length/4);
    var i;
    for(i=0;i<pixels.length;i++){
      pixels[i] = [arr[i*4], arr[(i*4)+1], arr[(i*4)+2]]
    }
    for(i=0;i<hGuage;i++){
      map.push(pixels.splice(0,wGuage))
    }
    return map;
  }

  var image = makeImageMap(imageData);
  var bayermatrix = [
     [0,  8,  2,  10],
     [12,  4,  14, 6],
     [3,  11, 1,  9],
     [15, 7, 13,  5]
  ];
  var matrix = ditherMatrix || bayermatrix;
  var ditheredMap = [];
  var i,j;
  for(i=0; i<image.length; i++){
    var hindex = i % 4
    var row = []
    for(j=0;j<image[i].length; j++){
      var windex = j % 4
      var a = (matrix[hindex][windex]*Math.ceil(matrix.length*matrix[0].length))+8
      ditheredMap.push(a < Math.max.apply(null,image[i][j]) ? 0 : 1);
    }
  }
  return ditheredMap
}


/* Canvas drawing functions */

// Draws arms, neck & bottom rib.
function drawParts(){
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  var w = canvas.width;
  canvas.width = 1;
  canvas.width = w;

  //neck
  ctx.beginPath();
  ctx.moveTo(270,0);
  ctx.lineTo(250,10);
  ctx.quadraticCurveTo(390,120,530,10);
  ctx.lineTo(510,0);
  ctx.quadraticCurveTo(390,90,270,0);
  ctx.fillStyle = color2;
  ctx.fill();

  //left arm
  ctx.beginPath();
  ctx.moveTo(640,30);
  ctx.quadraticCurveTo(635,140,670,290);
  ctx.lineTo(653,570);
  ctx.quadraticCurveTo(652,605,660,640);
  ctx.lineTo(730,640);
  ctx.bezierCurveTo(780,400,770,50,640,30);
  ctx.fillStyle = color2;
  ctx.fill();

  //right arm
  ctx.beginPath();
  ctx.moveTo(140,30);
  ctx.quadraticCurveTo(145,140,122,280);
  ctx.lineTo(129,570);
  ctx.quadraticCurveTo(130,605,120,640);
  ctx.lineTo(50,640);
  ctx.bezierCurveTo(20,400,30,50,140,30);
  ctx.fillStyle = color2;
  ctx.fill();

  //bottom
  ctx.beginPath();
  ctx.moveTo(130,630);
  ctx.lineTo(130,660);
  ctx.quadraticCurveTo(390,680,650,660);
  ctx.lineTo(650,630);
  ctx.quadraticCurveTo(390,650,130,630);
  ctx.fillStyle = color2;
  ctx.fill();

  drawClip(ctx);
}

// Draw body parts and create clip.
function drawClip(){
  ctx.beginPath();
  ctx.moveTo(250,10);
  ctx.lineTo(140,30);
  ctx.quadraticCurveTo(145,140,120,280); //right curve
  ctx.lineTo(130,630);
  ctx.quadraticCurveTo(390,650,650,630); //bottom curve
  ctx.lineTo(670,290);
  ctx.quadraticCurveTo(635,140,640,30); //left curve
  ctx.lineTo(530,10);
  ctx.quadraticCurveTo(390,120,250,10); //neck curve
  ctx.fillStyle = color1;
  ctx.fill();
  ctx.clip();
}

// Call knit() to draw pattern on body.
function drawSts(){
  drawClip(ctx);
  for(var y = 0; y<imgHeight;y++){
    for(var x=0; x<imgWidth; x++){
      var color = oneBitImg[x+(imgWidth*y)] === 0 ? color1 : color2;
      knit(x*sWidth+90+(offsetX*sWidth),y*(sHeight-dip)+10+(offsetY*(sHeight-dip)), color);
    }
  }
}

// Draw V shape on specified x:y coordinates
function knit(x, y, fill){
  ctx.beginPath();
  ctx.moveTo(x+(sWidth/2),y+dip);
  ctx.lineTo(x,y);
  ctx.lineTo(x,y+(sHeight-dip));
  ctx.lineTo(x+(sWidth/2),y+sHeight);
  ctx.lineTo(x+(sWidth/2),y+dip);
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x+(sWidth/2),y+dip);
  ctx.lineTo(x+sWidth,y);
  ctx.lineTo(x+sWidth,y+(sHeight-dip));
  ctx.lineTo(x+(sWidth/2),y+sHeight);
  ctx.lineTo(x+(sWidth/2),y+dip);
  ctx.fillStyle = fill;
  ctx.fill();
}
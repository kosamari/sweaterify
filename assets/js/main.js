var sf = window.devicePixelRatio

// size of the sweater body part
var bodyWidth = 600
var bodyHeight = 660
var aspectratio = bodyHeight / bodyWidth

// how many stitches to show on the body
var sts
var rows

// size of each stitches (width & height)
var sWidth
var sHeight

// how far v of the stitch drops
var dip

// size padding for drawing stitches
var leftArmWidth = 90 * sf
var neckHeight = 10 * sf

// size of image (scale down to sts or rows depending on aspect ratio)
var imgWidth
var imgHeight

// blob store for download
var imageFile

// imageData of the currently sweater body (for color change)
var currentImageData

// scale for guide canvas <-> baseImage size conversion
var scale
var reverseScale

// guide canvas positions
var rectPos
var mousePos

// color picker state
var colors = {
  fill: 0,
  parts: 0,
  list: ['#C60204', '#DB3737', '#F27268', '#FCFCFC']
}

// image process mode
var mode = {
  current: null,
  brightness: 0,
  invert: false,
  colorNum: 2,
  repeatNum: 5,
  dither: dither,
  posterize: posterize,
  repeat: posterize
}

// elements used in this app
var reader = new FileReader()
var img = new Image()
var $fileInput = document.getElementById('file')
var $canvas = document.getElementById('canvas')
var $guideCanvas = document.getElementById('canvas-guide')
var $a = document.getElementById('download-link')
var $download = document.getElementById('download')
var $downloadWallpaper = document.getElementById('download-wallpaper')
var $guideTitle = document.getElementById('canvas-guide-title')
var $guageSlider = document.getElementById('guage')
var $brightnessSlider = document.getElementById('brightness')
var $colorSizeSelector = document.getElementById('colorsize')
var $repeatSizeSelector = document.getElementById('repeatsize')
var $repeatMenu = document.getElementById('repeat-menu')
var $color0 = document.getElementById('color0')
var $color1 = document.getElementById('color1')
var $color2 = document.getElementById('color2')
var $color3 = document.getElementById('color3')
var $colorNumMenu = document.getElementById('color-num-menu')
var $fillRadio = document.getElementsByName('fill')
var $partsRadio = document.getElementsByName('parts')
var $modeRadio = document.getElementsByName('mode')
var $invertCheck = document.getElementById('invert')
var $tabDither = document.getElementById('tab-dither')
var $tabPosterize = document.getElementById('tab-posterize')
var $tabRepeat = document.getElementById('tab-repeat')
var $patternImgBottom = document.getElementById('pattern-img-bottom')
var $patternImgTop = document.getElementById('pattern-img-top')
var baseImage = document.createElement('canvas')

// canvas contexts
var ctx = $canvas.getContext('2d') // sweater itself
var gctx = $guideCanvas.getContext('2d') // guide thumbnail
var bctx = baseImage.getContext('2d') // in-memory canvas for base image

/**
★────────────────────────★
          SET UP
★────────────────────────★
*/
mode.brightness = Number($brightnessSlider.value)
mode.colorNum = Number($colorSizeSelector.options[$colorSizeSelector.selectedIndex].value)
mode.repeatNum = Number($repeatSizeSelector.options[$repeatSizeSelector.selectedIndex].value)
$modeRadio.forEach(function ($el) {
  if ($el.checked) {
    mode.current = $el.value
    if ($el.value === 'posterize') {
      $colorNumMenu.style.display = 'flex'
    }else if ($el.value === 'repeat') {
      $repeatMenu.style.display = 'flex'
      $downloadWallpaper.style.display = 'inline-block'
      mode.colorNum = 2
    }
  }
})
setSize($guageSlider.value)
$color0.value = colors.list[0]
$color1.value = colors.list[1]
$color2.value = colors.list[2]
$color3.value = colors.list[3]
if ($invertCheck.checked) {
  mode.invert = true
}
$fillRadio.forEach(function (el) {
  if (el.value == colors.fill) {
    el.checked = true
  }
})
$partsRadio.forEach(function (el) {
  if (el.value == colors.parts) {
    el.checked = true
  }
})
drawParts()

$fileInput.addEventListener('change', function (e) {
  download.style.backgroundColor = 'gray'
  rectPos = undefined
  reader.readAsDataURL(e.target.files[0])
  reader.onload = function() {
    img.src = reader.result
    img.addEventListener('load', start, false)
  };
}, false)

// SWEATER DRAWING
function startRepeat () {
  mode.repeatNum = Number($repeatSizeSelector.options[$repeatSizeSelector.selectedIndex].value)
  imgWidth = sts / mode.repeatNum
  imgHeight = imgWidth * (img.height/img.width)
  // var x = (0.5 + (baseImage.width / 2) - (imgWidth / 2)) | 0
  var y = (0.5 + (baseImage.height / 2) - (imgHeight / 2)) | 0
  var x = (baseImage.width / 2) - (sts / 2)
  // add christmas decolations
  for (var i = 0; i < (baseImage.width / $patternImgTop.width); i++) {
    bctx.drawImage($patternImgTop, i*$patternImgTop.width, y-$patternImgTop.height )
    bctx.drawImage($patternImgBottom, i*$patternImgBottom.width, y+imgHeight )
  }
  var baseImageData = grayscale(makeImageData(img, imgWidth, imgHeight))
  if (mode.invert) {
    baseImageData = invert(baseImageData)
  }
  var extra = (0.5 + (baseImage.width / 2) / imgWidth) | 0
  for (var i = -extra; i < mode.repeatNum + extra; i++) {
    bctx.putImageData(baseImageData, x + i*imgWidth, y)
  }
  gctx.drawImage(baseImage, 0, 0, $guideCanvas.width,  $guideCanvas.height)
  gctx.strokeRect(rectPos.x[0] * scale, rectPos.y[0] * scale, sts * scale, rows * scale)
  knitSweaterBody(processImage())

}
function start () {
  bctx.globalAlpha = 0
  bctx.clearRect(0, 0, baseImage.width, baseImage.height)
  bctx.globalAlpha = 1
  gctx.clearRect(0, 0, $guideCanvas.width, $guideCanvas.height)
  $guideTitle.style.visibility = 'visible'
  $download.style.backgroundColor = 'orange'
  $downloadWallpaper.style.backgroundColor = 'orange'
  $download.disabled = false
  $downloadWallpaper.disabled = false

  if (!rectPos){
    rectPos = {}
    rectPos.x = [(baseImage.width / 2) - (sts / 2), (baseImage.width / 2) - (sts / 2) + sts]
    rectPos.y = [(baseImage.height / 2) - (rows / 2), (baseImage.height / 2) - (rows / 2) + rows]
  }

  if (mode.current === 'repeat') {
    return startRepeat()
  }

  if (img.width > img.height) {
    imgWidth = sts
    imgHeight = sts * (img.height/img.width)
  } else {
    imgWidth = rows * (img.width/img.height)
    imgHeight = rows
  }
  var x = (0.5 + (baseImage.width / 2) - (imgWidth / 2)) | 0
  var y = (0.5 + (baseImage.height / 2) - (imgHeight / 2)) | 0

  var baseImageData = grayscale(makeImageData(img, imgWidth, imgHeight))
  if (mode.invert) {
    baseImageData = invert(baseImageData)
  }
  bctx.putImageData(baseImageData, x, y)

  gctx.drawImage(img, ($guideCanvas.width / 2) - (imgWidth * scale / 2), ($guideCanvas.height / 2) - (imgHeight * scale / 2), imgWidth * scale, imgHeight * scale)
  gctx.strokeRect(rectPos.x[0] * scale, rectPos.y[0] * scale, sts * scale, rows * scale)
  knitSweaterBody(processImage())
}

function setSize (stsSize, previouse) {
  stsSize = Number(stsSize) // make sure it's number
  if (previouse) {
    var diff = stsSize/previouse
    rectPos.x = [rectPos.x[0] * diff, rectPos.x[1] * diff]
    rectPos.y = [rectPos.y[0] * diff, rectPos.y[1] * diff]
  }
  sts = stsSize
  rows = sts * aspectratio
  sWidth = (bodyWidth/sts) * sf
  sHeight = (bodyHeight/rows) * sf
  dip = sWidth/2
  $canvas.width = (sts * sWidth)+ (180 * sf)
  $canvas.height = (rows * sHeight)+ (30 * sf)
  $canvas.style.width = bodyWidth + 180 + 'px'
  $guideCanvas.width = 200
  $guideCanvas.height = 200 * (rows/sts)
  baseImage.width = sts * 2
  baseImage.height = rows * 2
  scale = $guideCanvas.width / baseImage.width
  reverseScale = baseImage.width / $guideCanvas.width
}

// COLOR PICKER
function setColor(num, color){
  // check for parts color and change color if that's the change
  colors.list[num] = '#' + color
  if (num === colors.parts) {
    drawParts()
  }
  if (num === colors.fill) {
    // drawParts() find way to change fill
  }
  if (currentImageData) {
    knitSweaterBody(currentImageData)
  }
}

function setRepeat(){
  mode.colorNum = 2
  // mode.repeatNum = Number($repeatSizeSelector.options[$repeatSizeSelector.selectedIndex].value)
}

function processImage () {
  if (img.src) {
    currentImageData = mode[mode.current](
                        brightness(
                          bctx.getImageData(rectPos.x[0], rectPos.y[0], sts, rows),
                          {level: mode.brightness}
                        ),
                        mode.colorNum)
    return currentImageData
  }
  return null
}

/**
★────────────────────────★
  KNIT DRAWING FUNCTIONS
★────────────────────────★
*/

// operator for drawing sweater body
function knitSweaterBody (imageData) {
  if (imageData) {
    // separate same color operations into group for canvas performance
    // if a pixel is transparent, it means it's outside of image (background to be filled)
    var ops = {0:[], 1:[], 2:[], 3:[]}
    for (var y = 0; y < imageData.height; y++) {
      for (var x = 0; x < imageData.width; x++) {
        var index = (x + (y * imageData.width)) * 4
        var opsIndex
        if (imageData.data[index + 3] === 0) {
          opsIndex = colors.fill
        } else {
          switch (imageData.data[index]) {
            case 85:
              opsIndex = 2
              break;
            case 128:
              opsIndex = 1
              break;
            case 170:
              opsIndex = 1
              break;
            case 255:
              opsIndex = 0
              break;
            default:
              // case 0
              opsIndex = 3
          }
        }
        ops[opsIndex].push([leftArmWidth + (x * sWidth), neckHeight + (y * sHeight)])
      }
    }

    // clear out sweater body
    drawClip()

    // knit each stitches, fill each color at once
    ctx.lineWidth = 0.05
    for (var i = 0; i < Object.keys(ops).length; i++) {
      ctx.beginPath()
      ops[i].forEach(function (arg) {
        knit.apply(null, arg)
      })
      ctx.fillStyle = colors.list[i]
      ctx.fill()
      ctx.stroke()
    }
  }
}

// Draw each stitches
function knit (x, y) {
  ctx.moveTo(x+(sWidth/2), y+dip)
  ctx.quadraticCurveTo(x+sWidth-(sWidth/3), y-(sHeight/12), x+sWidth-(sWidth/10), y-sHeight/4)
  ctx.quadraticCurveTo(x+sWidth-(sWidth/50), y, x+sWidth-(sWidth/70), y+(sHeight/10))
  ctx.bezierCurveTo(x+sWidth, y+(sHeight/4), x+sWidth, y+(sHeight*0.50), x+sWidth-(sWidth/15), y+(sHeight*0.66))
  ctx.bezierCurveTo(x+sWidth-(sWidth*0.3), y+sHeight, x+sWidth-(sWidth*0.3), y+sHeight, x+sWidth-(sWidth/2)+(sWidth/20), y+sHeight+sHeight/3)
  ctx.quadraticCurveTo(x+sWidth-(sWidth*0.55), y+(sHeight*0.7), x+sWidth-(sWidth/2),y+dip)

  ctx.moveTo(x+(sWidth/2)-sWidth*.05,y+dip)
  ctx.quadraticCurveTo(x+(sWidth*0.4), y+(sHeight/12), x+(sWidth/10), y-sHeight/4)
  ctx.quadraticCurveTo(x+(sWidth/50), y, x+(sWidth/70), y+(sHeight/10))
  ctx.bezierCurveTo(x, y+(sHeight/4), x, y+(sHeight*0.50), x+(sWidth/15), y+(sHeight*0.66))
  ctx.bezierCurveTo(x+(sWidth*0.3), y+sHeight, x+(sWidth*0.3), y+sHeight, x+(sWidth/2)-(sWidth/20), y+sHeight+sHeight/3)
  ctx.quadraticCurveTo(x+(sWidth*0.56), y+(sHeight+sHeight/4), x+(sWidth/2)-sWidth*.05,y+dip)
}

// Draws arms, neck & bottom rib.
function drawParts() {
  // clear canvas
  var w = $canvas.width
  $canvas.width = 0
  $canvas.width = w

  ctx.beginPath()

  //neck
  ctx.moveTo(270 * sf, 0 * sf)
  ctx.lineTo(250 * sf, 10 * sf)
  ctx.quadraticCurveTo(390 * sf,120 * sf,530 * sf,10 * sf)
  ctx.lineTo(510 * sf,0 * sf)
  ctx.quadraticCurveTo(390 * sf,90 * sf,270 * sf,0 * sf)
  ctx.fillStyle = colors.list[colors.parts]
  ctx.fill()

  //left arm
  ctx.beginPath()
  ctx.moveTo(640 * sf, 30 * sf)
  ctx.quadraticCurveTo(635 * sf, 140 * sf, 670 * sf, 290 * sf)
  ctx.lineTo(653 * sf, 570 * sf)
  ctx.quadraticCurveTo(652 * sf, 605 * sf, 660 * sf, 640 * sf)
  ctx.lineTo(730 * sf, 640 * sf)
  ctx.bezierCurveTo(780 * sf, 400 * sf, 770 * sf, 50 * sf, 640 * sf, 30 * sf)
  ctx.fillStyle = colors.list[colors.parts]
  ctx.fill()

  //right arm
  ctx.beginPath()
  ctx.moveTo(140 * sf, 30 * sf)
  ctx.quadraticCurveTo(145 * sf, 140 * sf, 122 * sf, 280 * sf)
  ctx.lineTo(129 * sf, 570 * sf)
  ctx.quadraticCurveTo(130 * sf, 605 * sf, 120 * sf, 640 * sf)
  ctx.lineTo(50 * sf, 640 * sf)
  ctx.bezierCurveTo(20 * sf, 400 * sf, 30 * sf, 50 * sf, 140 * sf, 30 * sf)
  ctx.fillStyle = colors.list[colors.parts]
  ctx.fill()

  //bottom rib
  ctx.beginPath()
  ctx.moveTo(130 * sf, 630 * sf)
  ctx.lineTo(130 * sf, 660 * sf)
  ctx.quadraticCurveTo(390 * sf, 680 * sf, 650 * sf, 660 * sf)
  ctx.lineTo(650 * sf, 630 * sf)
  ctx.quadraticCurveTo(390 * sf, 650 * sf, 130 * sf, 630 * sf)
  ctx.fillStyle = colors.list[colors.parts]
  ctx.fill()

  drawClip()
}

// Create clip path for sweater body
function drawClip() {
  ctx.beginPath()
  ctx.moveTo(250 * sf, 10 * sf)
  ctx.lineTo(140 * sf, 30 * sf)
  ctx.quadraticCurveTo(145 * sf, 140 * sf, 120 * sf, 280 * sf) //right curve
  ctx.lineTo(130 * sf, 630 * sf)
  ctx.quadraticCurveTo(390 * sf, 650 * sf, 650 * sf, 630 * sf) //bottom curve
  ctx.lineTo(670 * sf, 290 * sf)
  ctx.quadraticCurveTo(635 * sf, 140 * sf, 640 * sf, 30 * sf) //left curve
  ctx.lineTo(530 * sf, 10 * sf)
  ctx.quadraticCurveTo(390 * sf, 120 * sf, 250 * sf, 10 * sf) //neck curve
  ctx.fillStyle = colors.list[colors.fill]
  ctx.fill()
  ctx.clip()
}

/**
★────────────────────────★
    MODE SELCTOR EVENT
★────────────────────────★
*/
// Dither
$tabDither.addEventListener('change', function () {
  mode.current = this.value
  $colorNumMenu.style.display = 'none'
  $repeatMenu.style.display = 'none'
  $downloadWallpaper.style.display = 'none'
  if (currentImageData) {
    drawParts()
    start()
  }
})

// Posterize
$tabPosterize.addEventListener('change', function () {
  mode.current = this.value
  mode.colorNum = Number($colorSizeSelector.options[$colorSizeSelector.selectedIndex].value)
  $colorNumMenu.style.display = 'flex'
  $repeatMenu.style.display = 'none'
  $downloadWallpaper.style.display = 'none'

  if (currentImageData) {
    drawParts()
    start()
  }
})

// Repeat
$tabRepeat.addEventListener('change', function () {
  mode.current = this.value
  $colorNumMenu.style.display = 'none'
  $repeatMenu.style.display = 'flex'
  $downloadWallpaper.style.display = 'inline-block'

  setRepeat()
  if (currentImageData) {
    drawParts()
    start()
  }
})

/**
★────────────────────────★
   CONTROL MENU EVENTS
★────────────────────────★
*/
$invertCheck.addEventListener('change', function () {
  if(this.checked) {
    mode.invert = true
  } else {
    mode.invert = false
  }
  start()
})
$colorSizeSelector.addEventListener('change', function () {
  mode.colorNum = Number(this.options[this.selectedIndex].value)
  start()
})

$repeatSizeSelector.addEventListener('change', function () {
  mode.repeatNum = Number(this.options[this.selectedIndex].value)
  start()
})

$brightnessSlider.addEventListener('change', function () {
  mode.brightness = Number(this.value)
  start()
})
$guageSlider.addEventListener('change', function () {
  setSize(this.value, sts)
  drawParts()
  start()
})

/**
★────────────────────────★
   COLOR PICKER EVENTS
★────────────────────────★
*/
$color0.addEventListener('change', function (e) {
  setColor(0, this.jscolor)
})

$color1.addEventListener('change', function (e) {
  setColor(1, this.jscolor)
})

$color2.addEventListener('change', function (e) {
  setColor(2, this.jscolor)
})

$color3.addEventListener('change', function (e) {
  setColor(3, this.jscolor)
})

$fillRadio.forEach(function ($el) {
  $el.addEventListener('change', function () {
    colors.fill = $el.value
    knitSweaterBody(currentImageData)
  })
})

$partsRadio.forEach(function ($el) {
  $el.addEventListener('change', function () {
    colors.parts = $el.value
    drawParts()
    knitSweaterBody(currentImageData)
  })
})

/**
★────────────────────────★
    GUIDE CANVAS EVENTS
★────────────────────────★
*/
$guideCanvas.addEventListener('mousedown', function (e) {
  var x = e.layerX
  var y = e.layerY
  if (withInRange(x, [rectPos.x[0] * scale, rectPos.x[1] * scale]) && withInRange(y,  [rectPos.y[0] * scale, rectPos.y[1] * scale])) {
    mousePos = {x:x, y:y}
  }
}, false)

$guideCanvas.addEventListener('mousemove', function (e) {
  if (mousePos) {
    var xdiff = (0.5 + (e.layerX - mousePos.x) * reverseScale) | 0
    var ydiff = (0.5 + (e.layerY - mousePos.y) * reverseScale) | 0
    mousePos.x = e.layerX
    mousePos.y = e.layerY
    rectPos.x = [rectPos.x[0] + xdiff, rectPos.x[1] + xdiff]
    rectPos.y = [rectPos.y[0] + ydiff, rectPos.y[1] + ydiff]
    gctx.clearRect(0, 0, $guideCanvas.width, $guideCanvas.height)
    if (mode.current === 'repeat'){
      gctx.drawImage(baseImage, 0, 0, $guideCanvas.width, $guideCanvas.height)
    } else {
      gctx.drawImage(img, ($guideCanvas.width/2) - (imgWidth*scale/2), ($guideCanvas.height/2) - (imgHeight*scale/2), imgWidth*scale, imgHeight*scale)
    }
    gctx.strokeRect(rectPos.x[0] * scale, rectPos.y[0] * scale, sts * scale, rows * scale)
  }
}, false)

$guideCanvas.addEventListener('mouseup', function (e) {
  if (mousePos) {
    mousePos = undefined
    knitSweaterBody(processImage())
  }
}, false)

/**
★────────────────────────★
  DOWNLOAD BUTTON EVENT
★────────────────────────★
*/
$download.addEventListener('click', function () {
  $canvas.toBlob(function (blob) {
    // Check if image file was made previously & remove
    if (imageFile !== null) {
      window.URL.revokeObjectURL(imageFile)
    }
    imageFile = window.URL.createObjectURL(blob)
    $a.download = 'sweaterify.png'
    $a.href = imageFile
    $a.click()
  }, 'image/png')
}, false)

$downloadWallpaper.addEventListener('click', function () {
  var canvas = document.createElement('canvas')
  canvas.width = 10
  canvas.height = 10
  var ctx = canvas.getContext('2d')
  // do some drawing on to canvas

  canvas.toBlob(function (blob) {
    // Check if image file was made previously & remove
    if (imageFile !== null) {
      window.URL.revokeObjectURL(imageFile)
    }
    imageFile = window.URL.createObjectURL(blob)
    $a.download = 'sweaterify-wallpaper.png'
    $a.href = imageFile
    $a.click()
  }, 'image/png')
})

/**
★────────────────────────★
        UTILITIES
★────────────────────────★
*/

// Dither image & return imageData
function dither(imageData) {
  var bayermatrix = [
     [0,  128, 32,  160],
     [192,  64,  224, 96],
     [48,  176, 16,  144],
     [240, 112, 208,  80]
  ]
  for (var y = 0; y < imageData.height; y++) {
    for (var x = 0; x < imageData.width; x++) {
      var index = (x + (y * imageData.width)) * 4
      if(imageData.data[index + 3] !== 0) {
        var level = imageData.data[index] > bayermatrix[y % 4][x % 4] ? 255 : 0
        imageData.data[index] = level
        imageData.data[index + 1] = level
        imageData.data[index + 2] = level
        imageData.data[index + 3] = 255
      }
    }
  }
  return imageData
}

// Posterize image & return imageData
function posterize (imgData, colorsize) {
  // check options object & set default variables
  colorsize = colorsize || 4
  var pixelSize = imgData.width * imgData.height
  var min = 255
  var max = 0
  for (var i = 0; i < pixelSize; i++) {
    var index = i * 4
    if (imgData.data[index + 3] !== 0) {
      var value = imgData.data[index]
      if (value < min) {
        min = value
      }
      if (value>max) {
        max = value
      }
    }
  }
  var lookupTable = new Uint8Array(256)
  var colorWidth = (0.5 + ((max - min) / colorsize)) | 0
  var stepSize = (0.5 + (256 / (colorsize - 1))) | 0
  var index
  for (var level = 0; level < colorsize; level++) {
    for (var i = 0; i < colorWidth; i++) {
      index = min + (colorWidth * level) + i
      var val = level * stepSize
      if (val > 255) {
        val = 255
      }
      lookupTable[index] = val
    }
  }
  for (var i = index; i < 256; i++) {
    lookupTable[i] = 255
  }

  for (var i = 0; i < pixelSize; i++) {
    var index = i * 4
    imgData.data[index] = lookupTable[imgData.data[index]]
    imgData.data[index + 1] = lookupTable[imgData.data[index + 1]]
    imgData.data[index + 2] = lookupTable[imgData.data[index + 2]]
    imgData.data[index + 3] = imgData.data[index + 3]
  }

  return imgData
}

function grayscale (imgData, option) {
  // set check options object & set default options if necessary
  option = option || {}
  option.mode = option.mode || 'luma'
  option.channel = option.channel || 'g'

  // different grayscale methods
  var mode = {
    'luma': function (r, g, b) {
      return 0.299 * r + 0.587 * g + 0.114 * b
    },
    'simple': function (r, g, b, a, c) {
      var ref = {r: 0, g: 1, b: 2}
      return arguments[ref[c]]
    },
    'average': function (r, g, b) {
      return (r + g + b) / 3
    }
  }

  // loop through pixel size, extract r, g, b values & calculate grayscaled value
  for (var i = 0; i < (imgData.width*imgData.height); i++) {
    var index = i * 4
    var grayscaled = mode[option.mode](imgData.data[index], imgData.data[index + 1], imgData.data[index + 2], imgData.data[index + 3], option.channel)
    imgData.data[index] = grayscaled
    imgData.data[index + 1] = grayscaled
    imgData.data[index + 2] = grayscaled
    imgData.data[index + 3] = imgData.data[index + 3]
  }
  return imgData
}

function brightness (imgData, option) {
  // check options object
  option = option || {}
  option.level = option.level || 0

  var pixelSize = imgData.width * imgData.height

  for (var pixel = 0; pixel < pixelSize; pixel++) {
    var index = pixel * 4
    imgData.data[index] = imgData.data[index] + option.level
    imgData.data[index + 1] = imgData.data[index + 1] + option.level
    imgData.data[index + 2] = imgData.data[index + 2] + option.level
    imgData.data[index + 3] = imgData.data[index + 3]
  }

  return imgData
}

function invert (imgData) {
  for (var i = 0; i < imgData.data.length; i++) {
    if ((i + 1) % 4 === 0) {
      continue
    }
    imgData.data[i] = 255 - imgData.data[i]
  }
  return imgData
}

// create & return canvas imageData of given image.
function makeImageData(img, imgWidth, imgHeight) {
  var c = document.createElement('canvas')
  c.width = imgWidth
  c.height = imgHeight
  var ctx = c.getContext('2d')
  ctx.drawImage(img, 0, 0, imgWidth, imgHeight)
  return ctx.getImageData(0, 0, imgWidth, imgHeight)
}

// check if given val(number) is within range(array) of range[0] and range[1]
function withInRange (val, range) {
  if (val > range[0] && val < range[1]) {
    return true
  }
  return false
}

// toBlob Polyfill
if (!HTMLCanvasElement.prototype.toBlob) {
 Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
  value: function (callback, type, quality) {
    var binStr = atob(this.toDataURL(type, quality).split(',')[1])
    var len = binStr.length
    var arr = new Uint8Array(len)
    for (var i = 0; i < len; i++) {
      arr[i] = binStr.charCodeAt(i)
    }
    callback(new Blob( [arr], {type: type || 'image/png'}))
  }
 })
}
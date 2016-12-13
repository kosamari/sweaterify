/**
 * Sweaterify - Turn an image into a sweater.
 *
 * link    : https://kosamari.github.io/sweaterify/
 * license : Apache-2.0
 * author  : Mariko Kosaka (@kosamari)
 *
 */

/* global localStorage, FileReader, Image, HTMLCanvasElement, atob, Blob, XMLSerializer */
(function () {
  'use strict'
/**
★────────────────────────★
      BASE SETTINGS
★────────────────────────★
*/
  var sf = window.devicePixelRatio
  var baseFill = '0'
  var baseParts = '1'
  var baseColorset = 'C60204,B02C2C,00B36B,FCFCFC'

// color picker state
  var colors = {
    fill: Number(baseFill),
    parts: Number(baseParts),
    list: baseColorset.split(',')
  }
// image process mode info
  var mode = {
    current: 'repeat',
    brightness: 0,
    invert: false,
    repeatNum: 3,
    colorNum: 4,
    repeatColorNum: 2,
    dither: dither,
    posterize: posterize,
    repeat: posterize
  }

/**
★────────────────────────★
    LOCALSTORAGE SETUP
★────────────────────────★
*/
  var storedColors = localStorage.getItem('colors')
  var storedFill = localStorage.getItem('fill')
  var storedParts = localStorage.getItem('parts')
  if (storedColors) {
    colors.list = storedColors.split(',')
  }
  if (storedFill && !isNaN(storedFill)) {
    colors.fill = Number(storedFill)
  }
  if (storedParts && !isNaN(storedParts)) {
    colors.parts = Number(storedParts)
  }

/**
★────────────────────────★
    URL PARAM SETUP
★────────────────────────★
*/
  var modeParam = getParameterByName('mode')
  var repeatNumParam = Number(getParameterByName('repeat'))
  var colorNumParam = Number(getParameterByName('color'))
  var colorsParam = getParameterByName('colors')
  var invertParam = getParameterByName('invert')
  var stsParam = Number(getParameterByName('sts'))
  var downloadModeParam = getParameterByName('downloadmode')
  var svgDownloadParam = getParameterByName('svgdownload')

  var modemap = {
    dither: 'dither',
    posterize: 'posterize',
    repeat: 'repeat',
    halftone: 'dither',
    poster: 'posterize',
    holiday: 'repeat'
  }
  modeParam = modemap[modeParam]

  if (repeatNumParam < 0) {
    repeatNumParam = null
  }
  if (colorNumParam < 1 || colorNumParam > 4) {
    colorNumParam = null
  }
  if (colorsParam) {
    colorsParam = colorsParam.split(',')
    for (var i = 0; i < 4; i++) {
      var isHex = /[0-9A-F]{6}$/i.test(colorsParam[i])
      if (isHex) {
        colors.list[i] = colorsParam[i]
      }
    }
  }
  if (invertParam !== 'false' && invertParam !== 'true') {
    invertParam = null
  } else {
    invertParam = JSON.parse(invertParam)
  }
  if (svgDownloadParam !== 'false' && svgDownloadParam !== 'true') {
    svgDownloadParam = null
  } else {
    svgDownloadParam = JSON.parse(svgDownloadParam)
  }
  if (isNaN(stsParam) || stsParam < 1) {
    stsParam = null
  }

/**
★────────────────────────★
        VARIABLES
★────────────────────────★
*/
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

// elements used in this app
  var reader = new FileReader()
  var img = new Image()
  var $fileInput = document.getElementById('file')
  var $canvas = document.getElementById('canvas')
  var $guideCanvas = document.getElementById('canvas-guide')
  var $a = document.getElementById('download-link')
  var $download = document.getElementById('download')
  var $downloadPattern = document.getElementById('download-pattern')
  var $downloadSvg = document.getElementById('download-svg')
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
  var $invertCheck = document.getElementById('invert')
  var $tabDither = document.getElementById('tab-dither')
  var $tabPosterize = document.getElementById('tab-posterize')
  var $tabRepeat = document.getElementById('tab-repeat')
  var $resetColorBtn = document.getElementById('color-reset')
  var $patternImgBottom = document.getElementById('pattern-img-bottom')
  var $patternImgTop = document.getElementById('pattern-img-top')
  var baseImage = document.createElement('canvas')

// canvas contexts
  var ctx = $canvas.getContext('2d') // sweater itself
  var gctx = $guideCanvas.getContext('2d') // guide thumbnail
  var bctx = baseImage.getContext('2d') // in-memory canvas for base image

/**
★────────────────────────★
      INITIAL SET UP
★────────────────────────★
*/
  mode.brightness = Number($brightnessSlider.value)
  mode.colorNum = Number(colorNumParam) || mode.colorNum
  mode.repeatNum = Number(repeatNumParam) || mode.repeatNum
  mode.current = modeParam || mode.current

  if (mode.current === 'dither') {
    $tabDither.checked = true
  } else if (mode.current === 'posterize') {
    $colorNumMenu.style.display = 'flex'
    $tabPosterize.checked = true
  } else if (mode.current === 'repeat') {
    $repeatMenu.style.display = 'flex'
    $downloadWallpaper.style.display = 'inline-block'
    $tabRepeat.checked = true
  }

  if (svgDownloadParam) {
    $downloadSvg.style.display = 'inline-block'
  }

  $repeatSizeSelector.value = mode.repeatNum
  $colorSizeSelector.value = mode.colorNum
  $color0.value = colors.list[0]
  $color1.value = colors.list[1]
  $color2.value = colors.list[2]
  $color3.value = colors.list[3]

  setSize(stsParam || $guageSlider.value)

  if (invertParam || $invertCheck.checked) {
    mode.invert = true
    $invertCheck.checked = true
  }

  $fillRadio.forEach(function (el) {
    if (Number(el.value) === colors.fill) {
      el.checked = true
    }
  })

  $partsRadio.forEach(function (el) {
    if (Number(el.value) === colors.parts) {
      el.checked = true
    }
  })

  drawParts()

/**
★────────────────────────★
  APPLICATION FUNCTIONS
★────────────────────────★
*/
// SWEATER DRAWING
  function startRepeat () {
    imgWidth = sts / mode.repeatNum
    imgHeight = imgWidth * (img.height / img.width)
    var y = (0.5 + (baseImage.height / 2) - (imgHeight / 2)) | 0
    var x = (0.5 + (baseImage.width / 2) - (sts / 2)) | 0
    for (var i = 0; i < (baseImage.width / $patternImgTop.width); i++) {
      bctx.drawImage($patternImgTop, i * $patternImgTop.width, y - $patternImgTop.height)
      bctx.drawImage($patternImgBottom, i * $patternImgBottom.width, y + imgHeight)
    }
    var baseImageData = grayscale(makeImageData(img, imgWidth, imgHeight))
    if (mode.invert) {
      baseImageData = invert(baseImageData)
    }
    var extra = (0.5 + (baseImage.width / 2) / imgWidth) | 0
    for (var j = -extra; j < mode.repeatNum + extra; j++) {
      bctx.putImageData(baseImageData, x + j * imgWidth, y)
    }
    gctx.drawImage(baseImage, 0, 0, $guideCanvas.width, $guideCanvas.height)
    gctx.strokeStyle = '#C60204'
    gctx.strokeRect(rectPos.x[0] * scale, rectPos.y[0] * scale, sts * scale, rows * scale)
    knitSweaterBody(processImage(mode.repeatColorNum))
  }

  function start () {
    if (img.src) {
      bctx.globalAlpha = 0
      bctx.clearRect(0, 0, baseImage.width, baseImage.height)
      bctx.globalAlpha = 1
      gctx.clearRect(0, 0, $guideCanvas.width, $guideCanvas.height)

      $guideTitle.style.visibility = 'visible'
      $download.style.backgroundColor = '#4FA099'
      $downloadPattern.style.backgroundColor = '#4FA099'
      $downloadSvg.style.backgroundColor = '#4FA099'
      $downloadWallpaper.style.backgroundColor = '#4FA099'
      $download.disabled = false
      $downloadPattern.disabled = false
      $downloadSvg.disabled = false
      $downloadWallpaper.disabled = false

      if (!rectPos) {
        rectPos = {}
        rectPos.x = [(baseImage.width / 2) - (sts / 2), (baseImage.width / 2) - (sts / 2) + sts]
        rectPos.y = [(baseImage.height / 2) - (rows / 2), (baseImage.height / 2) - (rows / 2) + rows]
      }

      if (mode.current === 'repeat') {
        return startRepeat()
      }

      if (img.width > img.height) {
        imgWidth = sts
        imgHeight = sts * (img.height / img.width)
      } else {
        imgWidth = rows * (img.width / img.height)
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
      gctx.strokeStyle = '#C60204'
      gctx.strokeRect(rectPos.x[0] * scale, rectPos.y[0] * scale, sts * scale, rows * scale)
      knitSweaterBody(processImage())
    }
  }

// RESET SIZES FOR GUAGE CHANGE
  function setSize (stsSize, previouse) {
    stsSize = Number(stsSize) // make sure it's number
    if (previouse) {
      var diff = stsSize / previouse
      rectPos.x = [rectPos.x[0] * diff, rectPos.x[1] * diff]
      rectPos.y = [rectPos.y[0] * diff, rectPos.y[1] * diff]
    }
    sts = stsSize
    rows = sts * aspectratio
    sWidth = (bodyWidth / sts) * sf
    sHeight = (bodyHeight / rows) * sf
    dip = sWidth / 2
    $canvas.width = (sts * sWidth) + (180 * sf)
    $canvas.height = (rows * sHeight) + (30 * sf)
    $canvas.style.width = bodyWidth + 180 + 'px'
    $guideCanvas.width = 200
    $guideCanvas.height = 200 * (rows / sts)
    baseImage.width = sts * 2
    baseImage.height = rows * 2
    scale = $guideCanvas.width / baseImage.width
    reverseScale = baseImage.width / $guideCanvas.width
  }

// COLOR PICKER
  function setColor (num, color) {
  // check for parts color and change color if that's the change
    colors.list[num] = color
    localStorage.setItem('colors', colors.list.join(','))
    if (num === colors.parts) {
      drawParts()
    }
    if (num === colors.fill) {
      drawParts()
    }
    if (currentImageData) {
      knitSweaterBody(currentImageData)
    }
  }

// CREATES IMAGE DATA
  function processImage (colorNum) {
    colorNum = colorNum || mode.colorNum
    if (img.src) {
      currentImageData = mode[mode.current](
                        brightness(
                          bctx.getImageData(rectPos.x[0], rectPos.y[0], sts, rows),
                          {level: mode.brightness}
                        ), colorNum)
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
  // size padding for drawing stitches
    var leftArmWidth = 90 * sf
    var neckHeight = 10 * sf

    if (imageData) {
    // separate same color operations into group for canvas performance
    // if a pixel is transparent, it means it's outside of image (background to be filled)
      var ops = {0: [], 1: [], 2: [], 3: []}
      for (var y = 0; y < imageData.height; y++) {
        for (var x = 0; x < imageData.width; x++) {
          var index = (x + (y * imageData.width)) * 4
          var opsIndex
          if (imageData.data[index + 3] === 0) {
            opsIndex = colors.fill
          } else {
            opsIndex = findColor(imageData.data[index])
          }
          ops[opsIndex].push([leftArmWidth + (x * sWidth), neckHeight + (y * sHeight), ctx, sWidth, sHeight, dip])
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
        ctx.fillStyle = '#' + colors.list[i]
        ctx.fill()
        ctx.stroke()
      }
    }
  }

// find color number based on value of a pixel
  function findColor (val) {
    var colorNum
    switch (val) {
      case 85:
        colorNum = 1
        break
      case 128:
        colorNum = 2
        break
      case 170:
        colorNum = 2
        break
      case 255:
        colorNum = 3
        break
      default:
      // case 0
        colorNum = 0
    }
    return colorNum
  }

// Draw each stitches
  function knit (x, y, ctx, sWidth, sHeight, dip) {
    ctx.moveTo(x + (sWidth / 2), y + dip)
    ctx.quadraticCurveTo(x + sWidth - (sWidth / 3), y - (sHeight / 12), x + sWidth - (sWidth / 10), y - sHeight / 4)
    ctx.quadraticCurveTo(x + sWidth - (sWidth / 50), y, x + sWidth - (sWidth / 70), y + (sHeight / 10))
    ctx.bezierCurveTo(x + sWidth, y + (sHeight / 4), x + sWidth, y + (sHeight * 0.50), x + sWidth - (sWidth / 15), y + (sHeight * 0.66))
    ctx.bezierCurveTo(x + sWidth - (sWidth * 0.3), y + sHeight, x + sWidth - (sWidth * 0.3), y + sHeight, x + sWidth - (sWidth / 2) + (sWidth / 20), y + sHeight + sHeight / 3)
    ctx.quadraticCurveTo(x + sWidth - (sWidth * 0.55), y + (sHeight * 0.7), x + sWidth - (sWidth / 2), y + dip)

    ctx.moveTo(x + (sWidth / 2) - sWidth * 0.05, y + dip)
    ctx.quadraticCurveTo(x + (sWidth * 0.4), y + (sHeight / 12), x + (sWidth / 10), y - sHeight / 4)
    ctx.quadraticCurveTo(x + (sWidth / 50), y, x + (sWidth / 70), y + (sHeight / 10))
    ctx.bezierCurveTo(x, y + (sHeight / 4), x, y + (sHeight * 0.50), x + (sWidth / 15), y + (sHeight * 0.66))
    ctx.bezierCurveTo(x + (sWidth * 0.3), y + sHeight, x + (sWidth * 0.3), y + sHeight, x + (sWidth / 2) - (sWidth / 20), y + sHeight + sHeight / 3)
    ctx.quadraticCurveTo(x + (sWidth * 0.56), y + (sHeight + sHeight / 4), x + (sWidth / 2) - sWidth * 0.05, y + dip)
  }

// Draws arms, neck & bottom rib.
  function drawParts () {
  // clear canvas
    var w = $canvas.width
    $canvas.width = 0
    $canvas.width = w

    ctx.beginPath()

  // neck
    ctx.moveTo(270 * sf, 0 * sf)
    ctx.lineTo(250 * sf, 10 * sf)
    ctx.quadraticCurveTo(390 * sf, 120 * sf, 530 * sf, 10 * sf)
    ctx.lineTo(510 * sf, 0 * sf)
    ctx.quadraticCurveTo(390 * sf, 90 * sf, 270 * sf, 0 * sf)
    ctx.fillStyle = '#' + colors.list[colors.parts]
    ctx.fill()

  // left arm
    ctx.beginPath()
    ctx.moveTo(640 * sf, 30 * sf)
    ctx.quadraticCurveTo(635 * sf, 140 * sf, 670 * sf, 290 * sf)
    ctx.lineTo(653 * sf, 570 * sf)
    ctx.quadraticCurveTo(652 * sf, 605 * sf, 660 * sf, 640 * sf)
    ctx.lineTo(730 * sf, 640 * sf)
    ctx.bezierCurveTo(780 * sf, 400 * sf, 770 * sf, 50 * sf, 640 * sf, 30 * sf)
    ctx.fillStyle = '#' + colors.list[colors.parts]
    ctx.fill()

  // right arm
    ctx.beginPath()
    ctx.moveTo(140 * sf, 30 * sf)
    ctx.quadraticCurveTo(145 * sf, 140 * sf, 122 * sf, 280 * sf)
    ctx.lineTo(129 * sf, 570 * sf)
    ctx.quadraticCurveTo(130 * sf, 605 * sf, 120 * sf, 640 * sf)
    ctx.lineTo(50 * sf, 640 * sf)
    ctx.bezierCurveTo(20 * sf, 400 * sf, 30 * sf, 50 * sf, 140 * sf, 30 * sf)
    ctx.fillStyle = '#' + colors.list[colors.parts]
    ctx.fill()

  // bottom rib
    ctx.beginPath()
    ctx.moveTo(130 * sf, 630 * sf)
    ctx.lineTo(130 * sf, 660 * sf)
    ctx.quadraticCurveTo(390 * sf, 680 * sf, 650 * sf, 660 * sf)
    ctx.lineTo(650 * sf, 630 * sf)
    ctx.quadraticCurveTo(390 * sf, 650 * sf, 130 * sf, 630 * sf)
    ctx.fillStyle = '#' + colors.list[colors.parts]
    ctx.fill()

    drawClip()
  }

// Create clip path for sweater body
  function drawClip () {
    ctx.beginPath()
    ctx.moveTo(250 * sf, 10 * sf)
    ctx.lineTo(140 * sf, 30 * sf)
    ctx.quadraticCurveTo(145 * sf, 140 * sf, 120 * sf, 280 * sf) // right curve
    ctx.lineTo(130 * sf, 630 * sf)
    ctx.quadraticCurveTo(390 * sf, 650 * sf, 650 * sf, 630 * sf) // bottom curve
    ctx.lineTo(670 * sf, 290 * sf)
    ctx.quadraticCurveTo(635 * sf, 140 * sf, 640 * sf, 30 * sf) // left curve
    ctx.lineTo(530 * sf, 10 * sf)
    ctx.quadraticCurveTo(390 * sf, 120 * sf, 250 * sf, 10 * sf) // neck curve
    ctx.fillStyle = '#' + colors.list[colors.fill]
    ctx.fill()
    ctx.clip()
  }

/**
★────────────────────────★
     FILE INPUT EVENT
★────────────────────────★
*/
  $fileInput.addEventListener('change', function (e) {
    rectPos = undefined
    reader.readAsDataURL(e.target.files[0])
    reader.onload = function () {
      img.src = reader.result
      img.addEventListener('load', start, false)
    }
  }, false)

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
  }, false)

// Posterize
  $tabPosterize.addEventListener('change', function () {
    mode.current = this.value
    $colorNumMenu.style.display = 'flex'
    $repeatMenu.style.display = 'none'
    $downloadWallpaper.style.display = 'none'

    if (currentImageData) {
      drawParts()
      start()
    }
  }, false)

// Repeat
  $tabRepeat.addEventListener('change', function () {
    mode.current = this.value
    $colorNumMenu.style.display = 'none'
    $repeatMenu.style.display = 'flex'
    $downloadWallpaper.style.display = 'inline-block'

    if (currentImageData) {
      drawParts()
      start()
    }
  }, false)

/**
★────────────────────────★
   CONTROL MENU EVENTS
★────────────────────────★
*/
  $invertCheck.addEventListener('change', function () {
    if (this.checked) {
      mode.invert = true
    } else {
      mode.invert = false
    }
    start()
  }, false)

  $colorSizeSelector.addEventListener('change', function () {
    mode.colorNum = Number(this.options[this.selectedIndex].value)
    start()
  }, false)

  $repeatSizeSelector.addEventListener('change', function () {
    mode.repeatNum = Number(this.options[this.selectedIndex].value)
    start()
  }, false)

  $brightnessSlider.addEventListener('change', function () {
    mode.brightness = Number(this.value)
    start()
  }, false)

  $guageSlider.addEventListener('change', function () {
    setSize(this.value, sts)
    drawParts()
    start()
  }, false)

/**
★────────────────────────★
   COLOR PICKER EVENTS
★────────────────────────★
*/
  $color0.addEventListener('change', function () {
    setColor(0, this.jscolor.toString())
  }, false)

  $color1.addEventListener('change', function () {
    setColor(1, this.jscolor.toString())
  }, false)

  $color2.addEventListener('change', function () {
    setColor(2, this.jscolor.toString())
  }, false)

  $color3.addEventListener('change', function () {
    setColor(3, this.jscolor.toString())
  }, false)

  $fillRadio.forEach(function ($el) {
    $el.addEventListener('change', function () {
      colors.fill = Number($el.value)
      localStorage.setItem('fill', colors.fill)
      drawParts()
      knitSweaterBody(currentImageData)
    })
  }, false)

  $partsRadio.forEach(function ($el) {
    $el.addEventListener('change', function () {
      colors.parts = Number($el.value)
      localStorage.setItem('parts', colors.parts)
      drawParts()
      knitSweaterBody(currentImageData)
    })
  }, false)

  $resetColorBtn.addEventListener('click', function () {
    var _colors = baseColorset.split(',')
  // document.getElementById('idToChange').jscolor.fromString(jsObj.toHEXString());
    $color0.jscolor.fromString(_colors[0])
    $color1.jscolor.fromString(_colors[1])
    $color2.jscolor.fromString(_colors[2])
    $color3.jscolor.fromString(_colors[3])
    colors.list = _colors

    colors.fill = Number(baseFill)
    colors.parts = Number(baseParts)

    $fillRadio.forEach(function (el) {
      if (el.value === baseFill) {
        el.checked = true
      }
    })
    $partsRadio.forEach(function (el) {
      if (el.value === baseParts) {
        el.checked = true
      }
    })
    localStorage.clear()
    drawParts()
    knitSweaterBody(currentImageData)
  })

/**
★────────────────────────★
    GUIDE CANVAS EVENTS
★────────────────────────★
*/
  $guideCanvas.addEventListener('mousedown', function (e) {
    var x = e.layerX
    var y = e.layerY
    if (withInRange(x, [rectPos.x[0] * scale, rectPos.x[1] * scale]) && withInRange(y, [rectPos.y[0] * scale, rectPos.y[1] * scale])) {
      mousePos = {x: x, y: y}
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
      if (mode.current === 'repeat') {
        gctx.drawImage(baseImage, 0, 0, $guideCanvas.width, $guideCanvas.height)
      } else {
        gctx.drawImage(img, ($guideCanvas.width / 2) - (imgWidth * scale / 2), ($guideCanvas.height / 2) - (imgHeight * scale / 2), imgWidth * scale, imgHeight * scale)
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
    var targetCanvas = $canvas

    if (downloadModeParam === 'raw') {
      var _canvas = document.createElement('canvas')
      _canvas.width = currentImageData.width
      _canvas.width = currentImageData.height
      var _ctx = _canvas.getContext('2d')
      _ctx.putImageData(currentImageData, 0, 0)
      targetCanvas = _canvas
    }

    targetCanvas.toBlob(function (blob) {
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

  $downloadPattern.addEventListener('click', function () {
    currentImageData
    var csvHeader = 'data:text/csv;charset=utf-8,'
    var lookupTable = {0: 0, 85: 1, 128: 2, 170: 2, 255: 3}
    var shapes = ['#', '%', '●']
    shapes.splice(colors.fill, 0, '')
    var csvContent = []

    var rowText
  // add stitches
    for (var y = 0; y < currentImageData.height; y++) {
      rowText = [(y + 1) % 5 === 0 ? y + 1 : '']
      for (var x = 0; x < currentImageData.width; x++) {
        var index = (x + (y * currentImageData.width)) * 4
        rowText.push(shapes[lookupTable[currentImageData.data[index]]])
      }
      csvContent.push(rowText.join(',') + '\n')
    }
  // create stitch guide every 5 stitches
    rowText = ['']
    for (var s = 0; s < currentImageData.width; s++) {
      rowText.push((s + 1) % 5 === 0 ? s + 1 : '')
    }
    csvContent.push(rowText.join(',') + '\n')
    csvContent.splice(0, 0, rowText.join(',') + '\n')

  // add color guide
    for (var i = 0; i < shapes.length; i++) {
      var shapeText = shapes[i] === '' ? '[blank]' : shapes[i]
      csvContent.splice(0, 0, shapeText + ',#' + colors.list[i] + '\n')
    }

    var encodedUri = encodeURI(csvHeader + csvContent.join(''))
    $a.download = 'sweaterify-pattern.csv'
    $a.href = encodedUri
    $a.click()
  }, false)

  $downloadSvg.addEventListener('click', function () {
    var svg = makeSvg()
    var binStr = new XMLSerializer().serializeToString(svg)
    var len = binStr.length
    var arr = new Uint8Array(len)
    for (var j = 0; j < len; j++) {
      arr[j] = binStr.charCodeAt(j)
    }
    var blob = new Blob([arr], {type: 'application/svg+xml'})
    if (imageFile !== null) {
      window.URL.revokeObjectURL(imageFile)
    }
    imageFile = window.URL.createObjectURL(blob)
    $a.download = 'sweaterify.svg'
    $a.href = imageFile
    $a.click()
  })

  $downloadWallpaper.addEventListener('click', function () {
    var cardWidth = 1920 * sf
    var cardHeight = 1200 * sf
    var cardScale = cardWidth / cardHeight
    var canvas = document.createElement('canvas')
    var ctx = canvas.getContext('2d')
    var scaledSts = 0.5 + (rows * cardScale) | 0
    var left = 0.5 + ((scaledSts - sts) / 2) | 0
    var imageData = mode[mode.current](
    brightness(
      bctx.getImageData(rectPos.x[0] - left, rectPos.y[0], scaledSts, rows),
      {level: mode.brightness}
    ),
    mode.repeatColorNum
  )
    var sWidth = 0.5 + (cardWidth / scaledSts) | 0
    var sHeight = 0.5 + (cardHeight / rows) | 0
    var dip = sHeight / 2

    canvas.width = sWidth * scaledSts
    canvas.height = sHeight * rows

    var ops = {0: [], 1: [], 2: [], 3: []}
    for (var y = 0; y < imageData.height; y++) {
      for (var x = 0; x < imageData.width; x++) {
        var index = (x + (y * imageData.width)) * 4
        var opsIndex
        if (imageData.data[index + 3] === 0) {
          opsIndex = colors.fill
        } else {
          if (imageData.data[index] === 255) {
            opsIndex = 3
          } else {
            opsIndex = 0
          }
        }
        ops[opsIndex].push([x * sWidth, y * sHeight, ctx, sWidth, sHeight, dip])
      }
    }

    ctx.fillRect(0, 0, canvas.width, canvas.height)
  // knit each stitches, fill each color at once
    ctx.lineWidth = 0.05
    for (var i = 0; i < Object.keys(ops).length; i++) {
      ctx.beginPath()
      ops[i].forEach(function (arg) {
        knit.apply(null, arg)
      })
      ctx.fillStyle = '#' + colors.list[i]
      ctx.fill()
      ctx.stroke()
    }

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
  }, false)

/**
★────────────────────────★
 MAKE SVG - EXPERIMENTAL!
★────────────────────────★
*/
  function makeStsPath (_x, _y) {
    return 'M ' + (_x + 0.95) + ' ' + (_y + 1) + ' Q' + (_x + 0.8) + ' ' + (_y + 0.17) + ' ' + (_x + 0.27) + ' ' + (_y - 0.5) + ' Q' + (_x + 0.01) + ' ' + _y + ' ' + (_x + 0.02) + ' ' + (_y + 0.2) + ' C' + _x + ' ' + (_y + 0.5) + ' ' + _x + ' ' + (_y + 1) + ' ' + (_x + 0.14) + ' ' + (_y + 1.3) + ' Q' + (_x + 0.6) + ' ' + (_y + 2) + ' ' + (_x + 0.87) + ' ' + (_y + 2.67) + ' Q' + (_x + 1.1) + ' ' + (_y + 2.5) + ' ' + (_x + 0.95) + ' ' + (_y + 1) + ' M' + (_x + 1.05) + ' ' + (_y + 1) + ' Q' + (_x + 1.2) + ' ' + (_y + 0.17) + ' ' + (_x + 1.73) + ' ' + (_y - 0.5) + ' Q' + (_x + 1.99) + ' ' + _y + ' ' + (_x + 1.98) + ' ' + (_y + 0.2) + ' C' + (_x + 2) + ' ' + (_y + 0.5) + ' ' + (_x + 2) + ' ' + (_y + 1) + ' ' + (_x + 1.86) + ' ' + (_y + 1.3) + ' Q' + (_x + 1.4) + ' ' + (_y + 2) + ' ' + (_x + 1.13) + ' ' + (_y + 2.67) + ' Q' + (_x + 0.96) + ' ' + (_y + 2.6) + ' ' + (_x + 1.05) + ' ' + (_y + 1)
  }

  function makeSvg () {
    var _sWidth = 2
    var _sHeight = 2
    var svgWidth = sts * _sWidth
    var svgHeight = rows * _sHeight
    var svgStrokeColor = '#000'
    var svgNS = 'http://www.w3.org/2000/svg'
    var svg = document.createElementNS(svgNS, 'svg')
    svg.setAttributeNS(null, 'width', svgWidth)
    svg.setAttributeNS(null, 'height', svgHeight)
    svg.setAttributeNS(null, 'viewBox', '0 0 ' + svgWidth + ' ' + svgHeight)

    var ops = {0: [], 1: [], 2: [], 3: []}
    for (var y = 0; y < currentImageData.height; y++) {
      for (var x = 0; x < currentImageData.width; x++) {
        var index = (x + (y * currentImageData.width)) * 4
        var opsIndex
        if (currentImageData.data[index + 3] === 0) {
          opsIndex = colors.fill
        } else {
          opsIndex = findColor(currentImageData.data[index])
        }
        ops[opsIndex].push([(x * _sWidth), (y * _sHeight)])
      }
    }
    for (var i = 0; i < Object.keys(ops).length; i++) {
      var g = document.createElementNS(svgNS, 'g')
      g.setAttributeNS(null, 'fill', '#' + colors.list[i])
      g.setAttributeNS(null, 'stroke', svgStrokeColor)
      g.setAttributeNS(null, 'stroke-width', '0.2')
      g.setAttributeNS(null, 'paint-order', 'stroke fill markers')

      ops[i].forEach(function (arg) {
        var d = makeStsPath.apply(null, arg)
        var path = document.createElementNS(svgNS, 'path')
        path.setAttributeNS(null, 'd', d)
        g.appendChild(path)
      })
      svg.appendChild(g)
    }

    return svg
  }

/**
★────────────────────────★
        UTILITIES
★────────────────────────★
*/
  function dither (imageData) {
    var bayermatrix = [
     [0, 128, 32, 160],
     [192, 64, 224, 96],
     [48, 176, 16, 144],
     [240, 112, 208, 80]
    ]
    for (var y = 0; y < imageData.height; y++) {
      for (var x = 0; x < imageData.width; x++) {
        var index = (x + (y * imageData.width)) * 4
        if (imageData.data[index + 3] !== 0) {
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

  function posterize (imgData, colorsize) {
    colorsize = colorsize || 4
    var pixelSize = imgData.width * imgData.height
    var min = 255
    var max = 0
    var index
    for (var i = 0; i < pixelSize; i++) {
      index = i * 4
      if (imgData.data[index + 3] !== 0) {
        var value = imgData.data[index]
        if (value < min) {
          min = value
        }
        if (value > max) {
          max = value
        }
      }
    }
    var lookupTable = new Uint8Array(256)
    var colorWidth = (0.5 + ((max - min) / colorsize)) | 0
    var stepSize = (0.5 + (256 / (colorsize - 1))) | 0
    for (var level = 0; level < colorsize; level++) {
      for (i = 0; i < colorWidth; i++) {
        index = min + (colorWidth * level) + i
        var val = level * stepSize
        if (val > 255) {
          val = 255
        }
        lookupTable[index] = val
      }
    }
    for (i = index; i < 256; i++) {
      lookupTable[i] = 255
    }

    for (i = 0; i < pixelSize; i++) {
      index = i * 4
      imgData.data[index] = lookupTable[imgData.data[index]]
      imgData.data[index + 1] = lookupTable[imgData.data[index + 1]]
      imgData.data[index + 2] = lookupTable[imgData.data[index + 2]]
      imgData.data[index + 3] = imgData.data[index + 3]
    }

    return imgData
  }

  function grayscale (imgData) {
    function luma (r, g, b) {
      return 0.299 * r + 0.587 * g + 0.114 * b
    }
  // loop through pixel size, extract r, g, b values & calculate grayscaled value
    for (var i = 0; i < (imgData.width * imgData.height); i++) {
      var index = i * 4
      var grayscaled = luma(imgData.data[index], imgData.data[index + 1], imgData.data[index + 2])
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
  function makeImageData (img, imgWidth, imgHeight) {
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

// parameter finder
  function getParameterByName (name, url) {
    if (!url) url = window.location.href
    name = name.replace(/[[\]]/g, '\\$&')
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)')
    var results = regex.exec(url)
    if (!results) return null
    if (!results[2]) return ''
    return decodeURIComponent(results[2].replace(/\+/g, ' '))
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
        callback(new Blob([arr], {type: type || 'image/png'}))
      }
    })
  }
})()

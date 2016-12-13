/* global self, caches, fetch */

'use strict'

var APP_PREFIX = 'sweaterify_'
var VERSION = 'version_14'
var CACHE_NAME = APP_PREFIX + VERSION
var URLS = [
  '/sweaterify/',
  '/sweaterify/index.html',
  '/sweaterify/assets/css/main.css',
  '/sweaterify/assets/js/main.min.js',
  '/sweaterify/assets/img/patterntop.png',
  '/sweaterify/assets/img/patternbottom.png'
]

// Respond with cached resources
self.addEventListener('fetch', function (e) {
  e.respondWith(
    caches.match(e.request).then(function (request) {
      return request || fetch(e.request)
    })
  )
})

// Cache resources
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      console.log('installing cache : ' + CACHE_NAME)
      return cache.addAll(URLS)
    })
  )
})

// Delete outdated caches
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keyList) {
      var cacheWhitelist = keyList.filter(function (key) {
        return key.indexOf(APP_PREFIX)
      })
      cacheWhitelist.push(CACHE_NAME)
      return Promise.all(keyList.map(function (key, i) {
        if (cacheWhitelist.indexOf(key) === -1) {
          console.log('deleting cache : ' + keyList[i])
          return caches.delete(keyList[i])
        }
      }))
    })
  )
})

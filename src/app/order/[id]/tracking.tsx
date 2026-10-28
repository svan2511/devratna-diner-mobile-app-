import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { Brand, Fonts } from '@/constants/brand';
import { api, SessionExpiredError, type ApiOrderTracking } from '@/lib/api';
import { setPendingOrdersTab } from '@/lib/notify-target';
import { useAuth } from '@/context/AuthContext';

const POLL_MS = 3000;

const FULFILL_LABEL: Record<string, string> = {
  new: 'Order received',
  preparing: 'Preparing',
  ready: 'Waiting for rider',
  out_for_delivery: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const FULFILL_TONE: Record<string, string> = {
  new: '#4F3CC9',
  preparing: '#8A5A00',
  ready: '#1A56DB',
  out_for_delivery: '#00695C',
  delivered: '#1E7A34',
  cancelled: '#B3261E',
};

type MapData = {
  shop: { lat: number; lng: number };
  destination: { lat: number; lng: number } | null;
  rider: { lat: number; lng: number; accuracy: number | null } | null;
};

/**
 * Free OpenStreetMap (Leaflet) map - no Google Maps key, no billing needed.
 * Trailers/updates WebView ke andar injectJavaScript se jaate hain, isliye
 * har poll pe map reload nahi hota.
 */
const MAP_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body { width: 100%; height: 100%; margin: 0; padding: 0; background: #f4ede3; }
    #map { width: 100%; height: 100%; }
    .pin {
      width: 18px; height: 18px; border-radius: 50%;
      border: 3px solid #ffffff;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    }
    .pin-shop { background: #C89B5B; }
    .pin-dest { background: #1E7A34; }
    .rider-pin {
      position: relative; width: 46px; height: 46px;
    }
    .rider-pin::after {
      content: ''; position: absolute; left: 8px; right: 8px; top: 8px; bottom: 8px;
      border-radius: 50%; background: rgba(0, 0, 0, 0.18);
      filter: blur(4px); z-index: 0;
    }
    .rider-bike {
      position: absolute; inset: 0; z-index: 1;
      transform-origin: 50% 50%;
      transition: transform 0.7s cubic-bezier(0.3, 0.8, 0.3, 1);
      filter: drop-shadow(0 0 1px rgba(255, 255, 255, 0.9)) drop-shadow(0 2px 3px rgba(0, 0, 0, 0.25));
      will-change: transform;
    }
    .rider-bike svg { width: 46px; height: 46px; display: block; }
    .leaflet-control-attribution { font-size: 9px; }
    .leaflet-bottom.leaflet-right { bottom: 300px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    (function () {
      var map = L.map('map', {
        zoomControl: false,
        attributionControl: true,
        zoomSnap: 0.5,
        zoomDelta: 0.5
      });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors · Valhalla'
      }).addTo(map);
      map.setView([30.271015, 77.9926317], 15);

      var shopMarker = null;
      var destMarker = null;
      var riderMarker = null;
      var riderAnim = null;
      var riderHeading = null;
      var lastHeadingAt = 0;
      var routeLine = null;
      var routeCoords = null;
      var routeKey = '';
      var routeRequestAt = 0;
      var lastProgressAt = 0;
      var latest = null;
      var autoFollow = true;
      var framing = false;
      var frameToken = 0;
      var lastAutoFrame = null;

      map.on('dragstart', function () {
        autoFollow = false;
      });

      map.on('zoomstart', function () {
        if (!framing) autoFollow = false;
      });

      var SCOOTER_SVG = '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">   <defs>     <linearGradient id="drBody" x1="24" y1="14" x2="42" y2="52" gradientUnits="userSpaceOnUse">       <stop offset="0" stop-color="#FFE477"/>       <stop offset=".45" stop-color="#FFC928"/>       <stop offset="1" stop-color="#EDA500"/>     </linearGradient>     <linearGradient id="drBodySide" x1="20" y1="0" x2="44" y2="0" gradientUnits="userSpaceOnUse">       <stop offset="0" stop-color="#D88900"/>       <stop offset=".2" stop-color="#FFD23F"/>       <stop offset=".8" stop-color="#FFD23F"/>       <stop offset="1" stop-color="#C77B00"/>     </linearGradient>     <linearGradient id="drBox" x1="22" y1="41" x2="42" y2="56" gradientUnits="userSpaceOnUse">       <stop offset="0" stop-color="#FFDE63"/>       <stop offset=".55" stop-color="#FFC21A"/>       <stop offset="1" stop-color="#E09A00"/>     </linearGradient>     <linearGradient id="drJacket" x1="22" y1="25" x2="42" y2="43" gradientUnits="userSpaceOnUse">       <stop offset="0" stop-color="#3E4C59"/>       <stop offset=".55" stop-color="#29343E"/>       <stop offset="1" stop-color="#151C22"/>     </linearGradient>     <linearGradient id="drHelmet" x1="27" y1="23" x2="37" y2="36" gradientUnits="userSpaceOnUse">       <stop offset="0" stop-color="#E07A55"/>       <stop offset=".45" stop-color="#C65D3A"/>       <stop offset="1" stop-color="#8E351D"/>     </linearGradient>     <linearGradient id="drJeans" x1="23" y1="32" x2="42" y2="42" gradientUnits="userSpaceOnUse">       <stop offset="0" stop-color="#4C6B8A"/>       <stop offset=".5" stop-color="#35506B"/>       <stop offset="1" stop-color="#24384C"/>     </linearGradient>     <radialGradient id="drGlow" cx="30" cy="20" r="22" gradientUnits="userSpaceOnUse">       <stop offset="0" stop-color="#FFFFFF" stop-opacity=".55"/>       <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>     </radialGradient>     <filter id="drSoft" x="-40%" y="-40%" width="180%" height="180%">       <feDropShadow dx="0" dy="1.2" stdDeviation="1" flood-color="#3C2500" flood-opacity=".35"/>     </filter>     <filter id="drSoft2" x="-40%" y="-40%" width="180%" height="180%">       <feDropShadow dx="0" dy="1.6" stdDeviation="1.2" flood-color="#000000" flood-opacity=".38"/>     </filter>   </defs>    <g stroke-linejoin="round" stroke-linecap="round">     <rect x="28.6" y="2.4" width="6.8" height="12.4" rx="3.4" fill="#161616" stroke="#0B0B0B" stroke-width=".7"/>     <rect x="30" y="4.2" width="4" height="7.6" rx="2" fill="#3A3A3A"/>     <rect x="28.6" y="49.2" width="6.8" height="12.4" rx="3.4" fill="#161616" stroke="#0B0B0B" stroke-width=".7"/>     <rect x="30" y="51.4" width="4" height="7.4" rx="2" fill="#3A3A3A"/>      <path d="M26.2 7.2c3.5-3.1 8.1-3.1 11.6 0l.5 10.1c-.4 1.5-1.7 2.3-3.1 1.9l-2.1-.6v-5.4h-2.2v5.4l-2.1.6c-1.4.4-2.7-.4-3.1-1.9z" fill="url(#drBody)" stroke="#B97900" stroke-width=".7" filter="url(#drSoft)"/>      <path d="M16 18.6h32" stroke="#161616" stroke-width="3.4"/>     <path d="M17.5 19.2 13.4 16.4M46.5 19.2l4.1-2.8" stroke="#2B2B2B" stroke-width="1.5"/>     <circle cx="12.6" cy="15.8" r="1.9" fill="#252525" stroke="#0C0C0C" stroke-width=".6"/>     <circle cx="51.4" cy="15.8" r="1.9" fill="#252525" stroke="#0C0C0C" stroke-width=".6"/>     <path d="M17.8 18.2h4.1M42.1 18.2h4.1" stroke="#0E0E0E" stroke-width="3" opacity=".9"/>      <path d="M25 13.5c4.5-2.3 9.5-2.3 14 0l1.4 8.4-1.2 27.5c-4.4 3-9.9 3-14.3 0L23.6 21.9z" fill="url(#drBodySide)" stroke="#AC6C00" stroke-width=".75"/>     <path d="M27.2 15.2c3.2-1.4 6.4-1.4 9.6 0l1 7.3-1 24.9c-3.1 1.5-6.5 1.5-9.6 0l-1-24.9z" fill="url(#drBody)"/>     <path d="M28 17.2c2.7-1 5.3-1 8 0l.7 5.5-1.1 23.9c-2.3.9-4.9.9-7.2 0L27.3 22.7z" fill="url(#drGlow)" opacity=".7"/>      <ellipse cx="32" cy="12.2" rx="3.1" ry="2.1" fill="#FFF9D9" stroke="#C99A2E" stroke-width=".6"/>     <path d="M30.7 11.7h2.6" stroke="#FFFFFF" stroke-width="1"/>      <rect x="21.2" y="42.4" width="21.6" height="13.4" rx="3.1" fill="url(#drBox)" stroke="#A96E00" stroke-width=".8" filter="url(#drSoft)"/>     <rect x="23.2" y="44" width="17.6" height="3.4" rx="1.4" fill="#FFE98B" opacity=".8"/>     <path d="M25.1 53h13.8" stroke="#B57A00" stroke-width="1.1" opacity=".55"/>     <path d="M26.3 47.4v8.4M37.7 47.4v8.4" stroke="#4B3410" stroke-width="1.1" opacity=".38"/>     <rect x="29.1" y="49.3" width="5.8" height="3.4" rx="1.1" fill="#FFF7DC" opacity=".9"/>     <path d="M30.4 50.3h3.2M30.4 51.6h2.2" stroke="#C65D3A" stroke-width=".55"/>      <path d="M28.1 38.4c-1.9 1.4-3.6 2.9-4.8 4.8-.7 1.1-.9 2.1-.3 2.8.7.8 1.9.5 2.7-.5 1-1.3 2.2-2.5 3.6-3.4z" fill="url(#drJeans)" stroke="#1C2D3D" stroke-width=".7"/>     <path d="M35.9 38.4c1.9 1.4 3.6 2.9 4.8 4.8.7 1.1.9 2.1.3 2.8-.7.8-1.9.5-2.7-.5-1-1.3-2.2-2.5-3.6-3.4z" fill="url(#drJeans)" stroke="#1C2D3D" stroke-width=".7"/>     <path d="M23.8 44.8c.7-.2 1.4-.1 2 .4l.7 1.7c-.7.7-1.5.9-2.4.5z" fill="#11181F"/>     <path d="M40.2 44.8c-.7-.2-1.4-.1-2 .4l-.7 1.7c.7.7 1.5.9 2.4.5z" fill="#11181F"/>      <path d="M23.4 28.4c5.1-3.3 12.1-3.3 17.2 0l.8 9.5c-1.8 2.4-4.6 3.7-9.4 3.7s-7.6-1.3-9.4-3.7z" fill="url(#drJacket)" stroke="#0D1318" stroke-width=".8" filter="url(#drSoft2)"/>     <path d="M25 30.2c4.3-2.3 9.7-2.3 14 0l.4 4.9c-4.7-1.5-10.1-1.5-14.8 0z" fill="#566674" opacity=".55"/>     <path d="M23.5 33.8c1.5 1.2 3.4 2.3 5.7 2.9M40.5 33.8c-1.5 1.2-3.4 2.3-5.7 2.9" stroke="#C89B5B" stroke-width="1" opacity=".75"/>      <path d="M25 30.7c-2.9-.8-4.8-2.8-5.2-5.8-.2-1.4.1-2.6 1.2-3.2 1.1-.6 2.3.1 2.7 1.4.5 1.7 1.6 3 3.2 4z" fill="url(#drJacket)" stroke="#0D1318" stroke-width=".8"/>     <path d="M39 30.7c2.9-.8 4.8-2.8 5.2-5.8.2-1.4-.1-2.6-1.2-3.2-1.1-.6-2.3.1-2.7 1.4-.5 1.7-1.6 3-3.2 4z" fill="url(#drJacket)" stroke="#0D1318" stroke-width=".8"/>     <circle cx="19.8" cy="20.6" r="2.6" fill="#171C20" stroke="#080A0C" stroke-width=".6"/>     <circle cx="44.2" cy="20.6" r="2.6" fill="#171C20" stroke="#080A0C" stroke-width=".6"/>     <path d="M18.5 19.6c.5-.5 1.1-.6 1.7-.4" stroke="#78858F" stroke-width=".8" opacity=".55"/>     <path d="M42.9 19.6c.5-.5 1.1-.6 1.7-.4" stroke="#78858F" stroke-width=".8" opacity=".55"/>      <circle cx="32" cy="29.1" r="7.5" fill="url(#drHelmet)" stroke="#000000" stroke-width=".8" filter="url(#drSoft2)"/>     <path d="M32 21.8c3.7 0 6.6 2.4 7.3 5.8-2.2 1.3-4.6 1.9-7.3 1.9s-5.1-.6-7.3-1.9c.7-3.4 3.6-5.8 7.3-5.8z" fill="#F4A07C" opacity=".5"/>     <path d="M28.1 23.4c2.6-1.5 5.2-1.5 7.8 0" stroke="#FFF1CC" stroke-width="1.3" opacity=".95"/>     <path d="M26.4 24.9c3.7-1.7 7.5-1.7 11.2 0" stroke="#141414" stroke-width="2.1" fill="none" opacity=".9"/>     <ellipse cx="29.3" cy="26.5" rx="2.2" ry="1.35" fill="#FFFFFF" opacity=".42" transform="rotate(-32 29.3 26.5)"/>     <circle cx="34.9" cy="31.7" r=".8" fill="#FFF1CC" opacity=".9"/>      <rect x="30.1" y="56.9" width="3.8" height="1.7" rx=".8" fill="#D92D20" opacity=".9"/>   </g> </svg>';

      function pinIcon(kind) {
        return L.divIcon({
          className: '',
          html: '<div class="pin pin-' + kind + '"></div>',
          iconSize: [18, 18],
          iconAnchor: [9, 9]
        });
      }

      function riderIcon() {
        var deg = riderHeading == null ? 0 : riderHeading;
        return L.divIcon({
          className: '',
          html: '<div class="rider-pin"><div class="rider-bike" style="transform: rotate(' + deg + 'deg)">' + SCOOTER_SVG + '</div></div>',
          iconSize: [46, 46],
          iconAnchor: [23, 23]
        });
      }

      function bearingDegrees(from, to) {
        var rad = Math.PI / 180;
        var lat1 = from.lat * rad;
        var lat2 = to.lat * rad;
        var dLng = (to.lng - from.lng) * rad;
        var y = Math.sin(dLng) * Math.cos(lat2);
        var x = Math.cos(lat1) * Math.sin(lat2) -
          Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
        return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
      }

      function updateRiderHeading(bearing) {
        if (!riderMarker) return;
        if (riderHeading == null) {
          riderHeading = bearing;
        } else {
          var delta = ((bearing - riderHeading + 540) % 360) - 180;
          riderHeading += delta;
        }

        var el = riderMarker.getElement();
        var bike = el && el.querySelector('.rider-bike');
        if (bike) {
          bike.style.transform = 'rotate(' + riderHeading + 'deg)';
        }
      }

      function drop(layer) {
        if (layer) { map.removeLayer(layer); }
        return null;
      }

      function metres(a, b) {
        var R = 6371000;
        var toRad = Math.PI / 180;
        var dLat = (b.lat - a.lat) * toRad;
        var dLng = (b.lng - a.lng) * toRad;
        var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) *
          Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
      }

      function fitMap(bounds, options) {
        framing = true;
        var token = ++frameToken;
        map.fitBounds(bounds, options);
        setTimeout(function () {
          if (token === frameToken) framing = false;
        }, 1200);
      }

      // Rapido jaisa auto-follow: rider ke saath map khud zoom-in hota hai,
      // aur rider + destination dono view me rehte hain.
      function autoFrame(data) {
        if (!autoFollow || !data.rider || !data.destination) return;

        var now = Date.now();
        if (lastAutoFrame) {
          if (now - lastAutoFrame.at < 1200) return;
          if (metres(lastAutoFrame.rider, data.rider) < 6) return;
        }

        lastAutoFrame = {
          rider: { lat: data.rider.lat, lng: data.rider.lng },
          at: now
        };

        fitMap(
          [
            [data.rider.lat, data.rider.lng],
            [data.destination.lat, data.destination.lng]
          ],
          {
            paddingTopLeft: [40, 120],
            paddingBottomRight: [40, 300],
            maxZoom: 18.5,
            animate: true,
            duration: 0.8
          }
        );
      }

      function lineLength(coords) {
        var total = 0;
        for (var i = 1; i < coords.length; i++) {
          total += metres(
            { lat: coords[i - 1][0], lng: coords[i - 1][1] },
            { lat: coords[i][0], lng: coords[i][1] }
          );
        }
        return total;
      }

      // App ko live remaining distance bhejo - UI isi se ETA update karta hai.
      function postProgress(metresLeft) {
        var now = Date.now();
        if (metresLeft > 1 && now - lastProgressAt < 400) return;
        lastProgressAt = now;

        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'route_progress',
            remaining_m: Math.max(0, Math.round(metresLeft))
          }));
        }
      }

      // GPS noise se marker aage-peeche na bhage - accuracy ke hisaab se
      // chhoti movement ignore karo. Har frame pe route bhi rider ke peeche
      // se trim hota hai, isliye blue line turant chhoti hoti hai.
      function moveRider(r) {
        if (!riderMarker) {
          var initial = routeHeadingAt(r);
          if (initial != null) {
            riderHeading = initial;
          } else if (latest && latest.shop && metres(latest.shop, r) > 3) {
            riderHeading = bearingDegrees(latest.shop, r);
          } else if (latest && latest.destination) {
            riderHeading = bearingDegrees(r, latest.destination);
          } else {
            riderHeading = 0;
          }
          lastHeadingAt = Date.now();
          riderMarker = L.marker([r.lat, r.lng], {
            icon: riderIcon(),
            title: 'Rider'
          }).addTo(map);
          trimRoute(r);
          return;
        }

        var from = riderMarker.getLatLng();
        var limit = Math.max(6, Math.min(30, Number(r.accuracy) || 8));
        if (metres({ lat: from.lat, lng: from.lng }, r) < limit) {
          trimRoute({ lat: from.lat, lng: from.lng });
          return;
        }

        updateRiderHeading(
          bearingDegrees({ lat: from.lat, lng: from.lng }, r)
        );

        var started = Date.now();
        var duration = 900;
        if (riderAnim) cancelAnimationFrame(riderAnim);

        function frame() {
          var t = Math.min(1, (Date.now() - started) / duration);
          var pos = {
            lat: from.lat + (r.lat - from.lat) * t,
            lng: from.lng + (r.lng - from.lng) * t
          };
          riderMarker.setLatLng([pos.lat, pos.lng]);
          trimRoute(pos);
          if (Date.now() - lastHeadingAt > 120) {
            lastHeadingAt = Date.now();
            var heading = routeHeadingAt(pos);
            if (heading != null) updateRiderHeading(heading);
          }
          if (t < 1) { riderAnim = requestAnimationFrame(frame); }
        }

        riderAnim = requestAnimationFrame(frame);
      }

      function decodePolyline6(encoded) {
        var coords = [];
        var index = 0;
        var lat = 0;
        var lng = 0;

        while (index < encoded.length) {
          var shift = 0;
          var result = 0;
          var byte = 0;

          do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
          } while (byte >= 0x20);
          lat += (result & 1) ? ~(result >> 1) : (result >> 1);

          shift = 0;
          result = 0;
          do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
          } while (byte >= 0x20);
          lng += (result & 1) ? ~(result >> 1) : (result >> 1);

          coords.push([lat / 1e6, lng / 1e6]);
        }

        return coords;
      }

      function routeStyle(isRoad) {
        if (isRoad) {
          return {
            color: '#1A73E8',
            weight: 5,
            opacity: 0.9,
            lineJoin: 'round',
            dashArray: null
          };
        }
        return {
          color: '#C65D3A',
          weight: 3,
          opacity: 0.55,
          dashArray: '6 8'
        };
      }

      function drawRoute(isRoad) {
        if (!routeCoords) return;
        if (!routeLine) {
          routeLine = L.polyline(routeCoords, routeStyle(isRoad)).addTo(map);
        } else {
          routeLine.setStyle(routeStyle(isRoad));
          routeLine.setLatLngs(routeCoords);
        }
      }

      function nearestPointOnRoute(r, coords) {
        var best = null;
        var kx = Math.cos(r.lat * Math.PI / 180);

        for (var i = 1; i < coords.length; i++) {
          var ax = coords[i - 1][1] * kx;
          var ay = coords[i - 1][0];
          var bx = coords[i][1] * kx;
          var by = coords[i][0];
          var px = r.lng * kx;
          var py = r.lat;
          var dx = bx - ax;
          var dy = by - ay;
          var len2 = dx * dx + dy * dy;
          var t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
          if (t < 0) t = 0;
          if (t > 1) t = 1;

          var q = {
            lat: coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * t,
            lng: coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * t
          };
          var d = metres(r, q);

          if (!best || d < best.d) {
            best = { d: d, i: i, q: q };
          }
        }

        return best;
      }

      // Rider ka face route ke tangent par rakho, taaki turns par marker
      // shortcut ki tarah cut na kare.
      function routeHeadingAt(point) {
        if (!routeCoords || routeCoords.length < 2) return null;

        var hit = nearestPointOnRoute(point, routeCoords);
        if (!hit || hit.d > 80) return null;

        var prev = hit.q;
        var target = null;
        var travelled = 0;

        for (var i = hit.i; i < routeCoords.length; i++) {
          var next = { lat: routeCoords[i][0], lng: routeCoords[i][1] };
          travelled += metres(prev, next);
          target = next;
          if (travelled >= 15) break;
          prev = next;
        }

        return target ? bearingDegrees(hit.q, target) : null;
      }

      // Rider ke peeche ki blue line hatao - sirf aage ka route dikhe.
      function trimRoute(r) {
        if (!routeLine || !routeCoords) return;
        if (!r) {
          routeLine.setLatLngs(routeCoords);
          return;
        }

        var hit = nearestPointOnRoute(r, routeCoords);
        if (!hit || hit.d > 120) {
          routeLine.setLatLngs(routeCoords);
          return;
        }

        var remaining = [[hit.q.lat, hit.q.lng]].concat(routeCoords.slice(hit.i));
        if (remaining.length < 2) {
          remaining = [[hit.q.lat, hit.q.lng], [hit.q.lat, hit.q.lng]];
        }
        routeLine.setLatLngs(remaining);
        postProgress(lineLength(remaining));
      }

      function dropRoute() {
        routeLine = drop(routeLine);
        routeCoords = null;
        routeKey = '';
        routeRequestAt = 0;
      }

      // Valhalla (free, no key) se shop->customer ka shortest scooter route.
      // Route ek hi baar load hota hai, rider ke move pe sirf trim hota hai.
      function loadRoute(shop, dest) {
        var key = shop.lat.toFixed(5) + ',' + shop.lng.toFixed(5) +
          '>' + dest.lat.toFixed(5) + ',' + dest.lng.toFixed(5);
        if (key === routeKey) return;

        var now = Date.now();
        if (now - routeRequestAt < 5000) return;
        routeRequestAt = now;
        routeKey = key;

        fetch('https://valhalla1.openstreetmap.de/route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            locations: [
              { lat: shop.lat, lon: shop.lng },
              { lat: dest.lat, lon: dest.lng }
            ],
            costing: 'motor_scooter'
          })
        })
          .then(function (res) { return res.json(); })
          .then(function (json) {
            var leg = json && json.trip && json.trip.legs && json.trip.legs[0];
            var shape = leg && leg.shape;
            if (typeof shape !== 'string' || !shape) {
              routeKey = '';
              return;
            }

            var pts = decodePolyline6(shape);
            if (pts.length < 2) {
              routeKey = '';
              return;
            }

            var start = { lat: pts[0][0], lng: pts[0][1] };
            if (metres(shop, start) > 10) {
              pts.unshift([shop.lat, shop.lng]);
            }
            var end = { lat: pts[pts.length - 1][0], lng: pts[pts.length - 1][1] };
            if (metres(end, dest) > 10) {
              pts.push([dest.lat, dest.lng]);
            }

            routeCoords = pts;
            drawRoute(true);
            if (riderMarker) {
              var at = riderMarker.getLatLng();
              var heading = routeHeadingAt({ lat: at.lat, lng: at.lng });
              if (heading != null) updateRiderHeading(heading);
              trimRoute({ lat: at.lat, lng: at.lng });
            } else {
              trimRoute(latest && latest.rider);
            }
          })
          .catch(function () {
            routeKey = '';
          });
      }

      function updateMap(data) {
        latest = data;
        var points = [[data.shop.lat, data.shop.lng]];

        if (!shopMarker) {
          shopMarker = L.marker([data.shop.lat, data.shop.lng], {
            icon: pinIcon('shop'),
            title: 'Dev Ratna Diner'
          }).addTo(map);
        } else {
          shopMarker.setLatLng([data.shop.lat, data.shop.lng]);
        }

        if (data.destination) {
          points.push([data.destination.lat, data.destination.lng]);
          if (!destMarker) {
            destMarker = L.marker([data.destination.lat, data.destination.lng], {
              icon: pinIcon('dest'),
              title: 'Delivery address'
            }).addTo(map);
          } else {
            destMarker.setLatLng([data.destination.lat, data.destination.lng]);
          }
        } else {
          destMarker = drop(destMarker);
        }

        if (data.destination) {
          if (!routeCoords) {
            routeCoords = [
              [data.shop.lat, data.shop.lng],
              [data.destination.lat, data.destination.lng]
            ];
            drawRoute(false);
          }
          loadRoute(data.shop, data.destination);
        } else {
          dropRoute();
        }

        if (data.rider) {
          points.push([data.rider.lat, data.rider.lng]);
          moveRider(data.rider);
        } else {
          riderMarker = drop(riderMarker);
          riderHeading = null;
          if (riderAnim) {
            cancelAnimationFrame(riderAnim);
            riderAnim = null;
          }
          trimRoute(null);
        }

        if (data.fit && points.length > 0) {
          fitMap(points, {
            paddingTopLeft: [50, 120],
            paddingBottomRight: [50, 300],
            maxZoom: 17,
            animate: true,
            duration: 0.8
          });
        } else {
          autoFrame(data);
        }
      }

      window.updateMap = updateMap;
      window.recenter = function () {
        autoFollow = true;
        lastAutoFrame = null;
        if (latest) {
          updateMap({
            shop: latest.shop,
            destination: latest.destination,
            rider: latest.rider,
            fit: true
          });
        }
      };
    })();
  </script>
</body>
</html>`;

function distanceLabel(m: number | null): string {
  if (m == null) return 'Location pending';
  if (m < 1000) return `${m}m away`;
  return `${(m / 1000).toFixed(1)} km away`;
}

export default function OrderTrackingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const orderId = Number(params.id);
  const insets = useSafeAreaInsets();
  const { token, forceLogout } = useAuth();
  const [tracking, setTracking] = useState<ApiOrderTracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [routeRemainingM, setRouteRemainingM] = useState<number | null>(null);
  const webRef = useRef<WebView | null>(null);
  const mapReady = useRef(false);
  const didFit = useRef(false);

  const handleAuthError = useCallback(async () => {
    await forceLogout();
    router.replace('/auth');
  }, [forceLogout, router]);

  const load = useCallback(
    async (silent = false) => {
      if (!token || !Number.isFinite(orderId)) return;
      if (!silent) setLoading(true);
      try {
        const next = await api.trackOrder(token, orderId);
        setTracking(next);
        setError(null);
      } catch (e) {
        if (e instanceof SessionExpiredError) {
          await handleAuthError();
          return;
        }
        if (!silent) setError(e instanceof Error ? e.message : 'Could not load tracking.');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [token, orderId, handleAuthError],
  );

  useEffect(() => {
    if (!token) {
      router.replace('/auth');
      return;
    }
    const kick = setTimeout(() => void load(), 0);
    const t = setInterval(() => void load(true), POLL_MS);
    return () => {
      clearTimeout(kick);
      clearInterval(t);
    };
  }, [token, load, router]);

  // Delivered hote hi map band — user seedha Orders ke "Delivered" tab par.
  // (Polling 3s me status pakadta hai, isliye rider deliver karte hi exit.)
  const didExitForDelivery = useRef(false);
  useEffect(() => {
    const order = tracking?.order;
    if (!order || didExitForDelivery.current) return;
    if (order.fulfillment_status !== 'delivered' && order.delivered_at == null) return;
    didExitForDelivery.current = true;
    setPendingOrdersTab('past');
    if (router.canGoBack()) router.back();
    else router.replace('/home');
  }, [tracking, router]);

  const mapData = useMemo<MapData | null>(() => {
    if (!tracking) return null;
    return {
      shop: { lat: tracking.shop.lat, lng: tracking.shop.lng },
      destination: tracking.destination
        ? { lat: tracking.destination.lat, lng: tracking.destination.lng }
        : null,
      rider: tracking.rider_location
          ? {
            lat: tracking.rider_location.lat,
            lng: tracking.rider_location.lng,
            accuracy: tracking.rider_location.accuracy_m ?? null,
          }
        : null,
    };
  }, [tracking]);

  const mapSource = useMemo(() => ({ html: MAP_HTML }), []);

  const pushMap = useCallback((data: MapData | null, fit: boolean) => {
    if (!data || !mapReady.current) return;
    webRef.current?.injectJavaScript(
      `window.updateMap(${JSON.stringify({ ...data, fit })}); true;`,
    );
  }, []);

  useEffect(() => {
    if (!mapData || !mapReady.current) return;
    const fit = !didFit.current;
    didFit.current = true;
    pushMap(mapData, fit);
  }, [mapData, pushMap]);

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/home');
  };

  const callRider = () => {
    if (tracking?.rider?.phone) void Linking.openURL(`tel:+91${tracking.rider.phone}`);
  };

  const recenter = () => {
    webRef.current?.injectJavaScript('window.recenter(); true;');
  };

  if (loading && !tracking) {
    return (
      <SafeAreaView style={styles.loadingRoot}>
        <ActivityIndicator size="large" color={Brand.terracotta} />
        <Text style={styles.loadingText}>Loading live rider location...</Text>
      </SafeAreaView>
    );
  }

  if (error && !tracking) {
    return (
      <SafeAreaView style={styles.loadingRoot}>
        <Text style={styles.errorTitle}>Tracking unavailable</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryBtn} onPress={() => void load()}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
        <Pressable style={styles.backLink} onPress={back}>
          <Text style={styles.backLinkText}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!tracking) return null;

  const { order, rider } = tracking;
  const status = order.fulfillment_status ?? 'new';
  const delivered = status === 'delivered' || order.delivered_at != null;
  const arrived = tracking.arrived && !delivered && status === 'out_for_delivery';
  const tone = arrived ? '#1E7A34' : (FULFILL_TONE[status] ?? Brand.stone);
  const statusLabel = arrived ? 'Rider reached' : (FULFILL_LABEL[status] ?? status);
  const liveRemainingM = delivered ? 0 : (routeRemainingM ?? tracking.distance_to_customer_m);
  const liveEtaSeconds =
    delivered
      ? 0
      : liveRemainingM == null
        ? (tracking.eta_minutes == null ? null : tracking.eta_minutes * 60)
        : liveRemainingM <= 25
          ? 0
          : Math.max(1, Math.ceil(liveRemainingM / 5));
  const etaClock =
    liveEtaSeconds == null
      ? null
      : `${Math.floor(liveEtaSeconds / 60)}:${String(liveEtaSeconds % 60).padStart(2, '0')}`;
  const etaText = delivered
    ? 'Delivered'
    : arrived
      ? 'Rider reached'
      : !rider
        ? 'Waiting for a rider assignment'
        : tracking.is_stale
          ? 'Last known rider location'
          : liveEtaSeconds == null
            ? 'Live location pending'
            : liveEtaSeconds === 0
              ? 'Reaching now'
              : liveEtaSeconds < 60
                ? `${liveEtaSeconds} sec away`
                : liveEtaSeconds % 60 === 0
                  ? `${liveEtaSeconds / 60} min away`
                  : `${Math.floor(liveEtaSeconds / 60)} min ${liveEtaSeconds % 60} sec away`;

  return (
    <View style={styles.root}>
      <WebView
        ref={webRef}
        style={StyleSheet.absoluteFill}
        source={mapSource}
        originWhitelist={['*']}
        onLoadEnd={() => {
          mapReady.current = true;
          setMapLoaded(true);
          const fit = !didFit.current;
          didFit.current = true;
          pushMap(mapData, fit);
        }}
        onError={() => setMapError(true)}
        onMessage={(event) => {
          try {
            const msg = JSON.parse(event.nativeEvent.data) as {
              type?: string;
              remaining_m?: number;
            };
            if (msg.type === 'route_progress' && typeof msg.remaining_m === 'number') {
              setRouteRemainingM(Math.max(0, Math.round(msg.remaining_m)));
            }
          } catch {
            // Map ke non-JSON messages ignore karo.
          }
        }}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        overScrollMode="never"
        bounces={false}
      />

      {mapError ? (
        <View style={styles.mapOverlay} pointerEvents="none">
          <Text style={styles.mapOverlayText}>
            Map could not load. Check your internet and reopen this screen.
          </Text>
        </View>
      ) : !mapLoaded ? (
        <View style={styles.mapOverlay} pointerEvents="none">
          <ActivityIndicator color={Brand.terracotta} />
          <Text style={styles.mapOverlayText}>Loading map...</Text>
        </View>
      ) : null}

      <SafeAreaView style={styles.topBar} edges={['top']} pointerEvents="box-none">
        <View style={styles.topBarInner}>
          <Pressable style={styles.backBtn} onPress={back}>
            <Text style={styles.backGlyph}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.topTitle}>Order #{order.id}</Text>
            <Text style={[styles.topStatus, { color: tone }]}>{statusLabel}</Text>
          </View>
          <Pressable style={styles.recenterBtn} onPress={recenter}>
            <Text style={styles.recenterText}>Recenter</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.sheetHandle} />
        <View style={styles.etaRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eta}>{etaText}</Text>
            <Text style={styles.distance}>
              {delivered
                ? 'Thank you for ordering from Dev Ratna!'
                : arrived
                  ? 'Your rider is nearby — please receive your order'
                  : distanceLabel(liveRemainingM)}
            </Text>
          </View>
          {!delivered && arrived ? (
            <View style={[styles.etaBadge, styles.arrivedBadge]}>
              <Text style={[styles.etaNumber, styles.arrivedBadgeText]}>✓</Text>
              <Text style={[styles.etaUnit, styles.arrivedBadgeText]}>HERE</Text>
            </View>
          ) : !delivered && etaClock != null && liveEtaSeconds !== 0 ? (
            <View style={styles.etaBadge}>
              <Text style={styles.etaNumber}>{etaClock}</Text>
              <Text style={styles.etaUnit}>LEFT</Text>
            </View>
          ) : null}
        </View>

        {arrived ? (
          <View style={styles.arrivedNote}>
            <Text style={styles.arrivedNoteTitle}>Your rider has arrived</Text>
            <Text style={styles.arrivedNoteBody}>Check the door or call your rider.</Text>
          </View>
        ) : null}

        <View style={styles.divider} />

        {rider ? (
          <View style={styles.riderRow}>
            <View style={styles.riderAvatar}>
              <Text style={styles.riderAvatarText}>
                {(rider.name ?? 'R').trim().charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.riderName}>{rider.name ?? 'Delivery partner'}</Text>
              <Text style={styles.riderMeta}>
                {rider.vehicle_type}
                {rider.vehicle_number ? ` - ${rider.vehicle_number}` : ''}
                {rider.is_online ? ' - online' : ''}
              </Text>
            </View>
            <Pressable style={styles.callBtn} onPress={callRider}>
              <Text style={styles.callText}>Call</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.riderRow}>
            <View style={[styles.riderAvatar, { backgroundColor: Brand.clay }]}>
              <Text style={[styles.riderAvatarText, { color: Brand.stone }]}>
                {delivered ? '✓' : '?'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.riderName}>
                {delivered ? 'Delivered by shop team' : 'Rider assignment pending'}
              </Text>
              <Text style={styles.riderMeta}>
                {delivered
                  ? 'Order delivered successfully.'
                  : 'The shop will assign a rider; live location will appear here.'}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.divider} />

        <View style={styles.destinationRow}>
          <View style={styles.destDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.destLabel}>Deliver to</Text>
            <Text style={styles.destAddress} numberOfLines={2}>
              {order.delivery_address ?? 'Your saved location'}
            </Text>
          </View>
          <Text style={styles.total}>₹{order.total}</Text>
        </View>

        {tracking.is_stale && !delivered ? (
          <Text style={styles.staleNote}>
            Rider GPS is over 90 seconds old — showing the last known location.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.cream },
  loadingRoot: {
    flex: 1,
    backgroundColor: Brand.cream,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    gap: 10,
  },
  loadingText: { color: Brand.stone, fontFamily: Fonts.body },
  errorTitle: { fontSize: 24, color: Brand.espresso, fontFamily: Fonts.display },
  errorText: {
    fontSize: 14,
    color: Brand.stone,
    textAlign: 'center',
    lineHeight: 21,
    fontFamily: Fonts.body,
  },
  retryBtn: {
    marginTop: 8,
    backgroundColor: Brand.terracotta,
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  retryText: { color: Brand.white, fontFamily: Fonts.bodyExtra, fontSize: 14 },
  backLink: { padding: 10 },
  backLinkText: { color: Brand.terracotta, fontFamily: Fonts.bodyBold, fontSize: 13 },
  mapOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    gap: 8,
    backgroundColor: 'rgba(255,248,238,0.9)',
  },
  mapOverlayText: {
    fontSize: 13,
    color: Brand.stone,
    textAlign: 'center',
    fontFamily: Fonts.body,
  },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0 },
  topBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    margin: 14,
    padding: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(255,248,238,0.96)',
    shadowColor: Brand.espresso,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Brand.creamRich,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: {
    fontSize: 28,
    lineHeight: 30,
    color: Brand.espresso,
    fontFamily: Fonts.body,
    marginTop: -2,
  },
  topTitle: { fontSize: 16, color: Brand.espresso, fontFamily: Fonts.bodyBold },
  topStatus: { marginTop: 1, fontSize: 12, fontFamily: Fonts.bodySemi },
  recenterBtn: {
    borderWidth: 1.5,
    borderColor: Brand.bone,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  recenterText: { fontSize: 11, color: Brand.espresso, fontFamily: Fonts.bodyBold },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Brand.white,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 18,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Brand.bone,
    marginBottom: 14,
  },
  etaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  eta: { fontSize: 24, color: Brand.espresso, fontFamily: Fonts.display },
  distance: { marginTop: 3, fontSize: 13, color: Brand.stone, fontFamily: Fonts.body },
  etaBadge: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: Brand.creamRich,
    borderWidth: 1.5,
    borderColor: Brand.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  etaNumber: { fontSize: 22, color: Brand.terracotta, fontFamily: Fonts.bodyExtra, lineHeight: 24 },
  etaUnit: { fontSize: 8, letterSpacing: 1.2, color: Brand.stone, fontFamily: Fonts.bodyExtra },
  arrivedBadge: { backgroundColor: '#E6F4EA', borderColor: '#1E7A34' },
  arrivedBadgeText: { color: '#1E7A34' },
  arrivedNote: {
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: '#E6F4EA',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 2,
  },
  arrivedNoteTitle: { fontSize: 14, color: '#1E7A34', fontFamily: Fonts.bodyExtra },
  arrivedNoteBody: { fontSize: 12, color: '#2F6B3C', fontFamily: Fonts.body },
  divider: { height: 1, backgroundColor: Brand.bone, marginVertical: 14 },
  riderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  riderAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Brand.espresso,
    alignItems: 'center',
    justifyContent: 'center',
  },
  riderAvatarText: { color: Brand.cream, fontSize: 18, fontFamily: Fonts.bodyExtra },
  riderName: { fontSize: 15, color: Brand.espresso, fontFamily: Fonts.bodyBold },
  riderMeta: {
    marginTop: 2,
    fontSize: 12,
    color: Brand.stone,
    textTransform: 'capitalize',
    fontFamily: Fonts.body,
  },
  callBtn: {
    backgroundColor: Brand.espresso,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  callText: { color: Brand.cream, fontSize: 12, fontFamily: Fonts.bodyExtra },
  destinationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  destDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#1E7A34',
    marginTop: 5,
  },
  destLabel: { fontSize: 10, letterSpacing: 1, color: Brand.stone, fontFamily: Fonts.bodyExtra },
  destAddress: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 19,
    color: Brand.charcoal,
    fontFamily: Fonts.bodyMed,
  },
  total: { fontSize: 18, color: Brand.terracotta, fontFamily: Fonts.bodyExtra },
  staleNote: {
    marginTop: 12,
    backgroundColor: '#FFF4DE',
    borderRadius: 10,
    padding: 10,
    fontSize: 11,
    lineHeight: 16,
    color: '#8A5A00',
    fontFamily: Fonts.bodyMed,
  },
});

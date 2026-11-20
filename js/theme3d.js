/* Scène 3D du hero : cubes flottants qui suivent la souris (CSS 3D, aucune librairie) */
(function () {
  var scene = document.getElementById('scene'), stage = document.getElementById('stage');
  if (!scene || !stage) return;
  var N = window.matchMedia('(max-width:768px)').matches ? 5 : 9, html = '';
  for (var i = 0; i < N; i++) {
    var s = 46 + (i * 37) % 70, h = [12, 45, 160, 225, 300][i % 5];
    html += '<div class="cw" style="--x:' + (8 + (i * 29) % 78) + '%;--y:' + (6 + (i * 41) % 70) + '%;--z:' + ((i % 4) * 40 - 60) + 'px;--b:' + (5 + i % 4) + 's">' +
      '<div class="cube" style="--s:' + s + 'px;--h:' + h + ';--d:' + (14 + (i * 5) % 14) + 's"><i class="f f1"></i><i class="f f2"></i><i class="f f3"></i><i class="f f4"></i><i class="f f5"></i><i class="f f6"></i></div></div>';
  }
  scene.innerHTML = html;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  window.addEventListener('pointermove', function (e) {
    if (document.body.classList.contains('in-game')) return;
    var x = e.clientX / innerWidth - .5, y = e.clientY / innerHeight - .5;
    scene.style.setProperty('--ry', (-10 - y * 26) + 'deg'); scene.style.setProperty('--rx', (18 + x * 40) + 'deg');
  }, { passive: true });
})();
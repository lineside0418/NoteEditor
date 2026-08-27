// Theme Manager: テーマ変更時のCSS変数再取得処理
  // ---------------------------------------------------------------
  function updateThemeColors() {
    TYPE_META.tap.color = getVar('--tap');
    TYPE_META.hold.color = getVar('--hold');
    TYPE_META.trace.color = getVar('--trace');
    TYPE_META.swap.color = getVar('--swap');
    TYPE_META.shift.color = getVar('--shift');
    TYPE_META.scramble.color = getVar('--scramble');

    // type-btnの色を同期
    el.typeButtons.forEach(btn => {
      const type = btn.dataset.type;
      const dot = btn.querySelector('.dot');
      if (dot && TYPE_META[type]) {
        dot.style.background = TYPE_META[type].color;
      }
    });
  }

  el.themeSelect.addEventListener('change', (e) => {
    document.body.setAttribute('data-theme', e.target.value);
    updateThemeColors();
    if (chart) {
      draw();
      updateNoteCounts();
      updateInspector();
    }
  });

  // ---------------------------------------------------------------
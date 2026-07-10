// Toggle handlers for various UI elements (Hillshade, Terrain, Bike Lanes, Missing Streets, etc.)

import { routeState } from '../routing/routeState.js';
import { switchMapTheme } from './mapThemeSwitcher.js';

// Initialize dark mode early (before DOMContentLoaded)
function initDarkMode() {
  // Check for manual override first
  const themeOverride = localStorage.getItem('theme-override');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  // If override doesn't match system preference, clear it to follow system
  if (themeOverride === 'dark' && !prefersDark) {
    localStorage.removeItem('theme-override');
    document.documentElement.removeAttribute('data-theme');
  } else if (themeOverride === 'light' && prefersDark) {
    localStorage.removeItem('theme-override');
    document.documentElement.removeAttribute('data-theme');
  } else if (themeOverride === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else if (themeOverride === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    // No manual override - use system preference
    // Remove data-theme attribute so CSS media query can work
    document.documentElement.removeAttribute('data-theme');
    console.log('[Theme] System prefers:', prefersDark ? 'DARK' : 'LIGHT');
  }
}

// Run immediately if DOM is ready, otherwise wait
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDarkMode);
} else {
  initDarkMode();
}

export function setupToggleHandlers() {
  // Dark mode toggle
  const darkModeToggle = document.getElementById('dark-mode-toggle');
  if (darkModeToggle) {
    // Update toggle icon based on current theme
    function updateToggleIcon() {
      const html = document.documentElement;
      const currentTheme = html.getAttribute('data-theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      
      // Determine actual theme (manual override or system preference)
      const actualTheme = currentTheme || (prefersDark ? 'dark' : 'light');
      
      // Update icon (sun for dark mode, moon for light mode would be better, but we use sun icon)
      // Could add moon icon later if needed
    }
    
    darkModeToggle.addEventListener('click', () => {
      console.debug('[UI] dark mode toggle clicked');
      const html = document.documentElement;
      const currentTheme = html.getAttribute('data-theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      
      // Determine current effective theme
      const effectiveTheme = currentTheme || (prefersDark ? 'dark' : 'light');
      
      let newTheme;
      if (effectiveTheme === 'dark') {
        // Switch to light mode
        html.setAttribute('data-theme', 'light');
        localStorage.setItem('theme-override', 'light');
        newTheme = 'light';
      } else {
        // Switch to dark mode
        html.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme-override', 'dark');
        newTheme = 'dark';
      }
      
      updateToggleIcon();
      
      // Also switch map theme if using style_light-dark.json
      if (window.map && document.body.hasAttribute('data-using-light-dark-style')) {
        const isDark = newTheme === 'dark';
        switchMapTheme(window.map, isDark);
        
        // Update basemap button selection
        const standardBtn = document.querySelector('.basemap-btn[data-map="standard"]');
        const darkBtn = document.querySelector('.basemap-btn[data-map="dark"]');
        if (isDark && darkBtn) {
          document.querySelectorAll('.basemap-thumb, .basemap-btn').forEach(t => t.classList.remove('selected'));
          darkBtn.classList.add('selected');
        } else if (!isDark && standardBtn) {
          document.querySelectorAll('.basemap-thumb, .basemap-btn').forEach(t => t.classList.remove('selected'));
          standardBtn.classList.add('selected');
        }
      }
      
      // Redraw heightgraph if it exists
      redrawHeightgraphOnThemeChange();
    });
    
    // Listen for system theme changes
    // If user changes system theme, we clear the manual override to follow system preference
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    mediaQuery.addEventListener('change', (e) => {
      const themeOverride = localStorage.getItem('theme-override');
      
      // If user changes system theme, clear manual override to follow system
      // This allows the page to react to system theme changes even if override was set
      if (themeOverride) {
        localStorage.removeItem('theme-override');
      }
      
      // Apply system preference
      // Remove data-theme to let CSS media query work
      document.documentElement.removeAttribute('data-theme');
      updateToggleIcon();
      
      // Also switch map theme if using style_light-dark.json
      if (window.map && document.body.hasAttribute('data-using-light-dark-style')) {
        const isDark = e.matches;
        switchMapTheme(window.map, isDark);
        
        // Update basemap button selection
        const standardBtn = document.querySelector('.basemap-btn[data-map="standard"]');
        const darkBtn = document.querySelector('.basemap-btn[data-map="dark"]');
        if (isDark && darkBtn) {
          document.querySelectorAll('.basemap-thumb, .basemap-btn').forEach(t => t.classList.remove('selected'));
          darkBtn.classList.add('selected');
        } else if (!isDark && standardBtn) {
          document.querySelectorAll('.basemap-thumb, .basemap-btn').forEach(t => t.classList.remove('selected'));
          standardBtn.classList.add('selected');
        }
      }
      
      redrawHeightgraphOnThemeChange();
    });
    
    // Initial icon update
    updateToggleIcon();
  }
  
  // Function to redraw heightgraph when theme changes
  function redrawHeightgraphOnThemeChange() {
    // Wait a bit for theme to be applied
    setTimeout(() => {
      if (routeState && routeState.currentRouteData) {
        const { elevations, distance, encodedValues, coordinates } = routeState.currentRouteData;
        if (elevations || Object.keys(encodedValues || {}).length > 0) {
          import('../routing/heightgraph.js').then(({ drawHeightgraph }) => {
            drawHeightgraph(
              elevations || [],
              distance,
              encodedValues || {},
              coordinates || []
            );
          }).catch(err => {
            console.warn('Could not redraw heightgraph on theme change:', err);
          });
        }
      }
    }, 150);
  }

  // Toggle logic for Hillshade and Terrain
  const toggleHillshade = document.getElementById('toggleHillshade');
  const toggleTerrain = document.getElementById('toggleTerrain');
  
  if (toggleHillshade) {
    toggleHillshade.addEventListener('change', (e) => {
      if (window.map && window.map.getLayer('hillshade-layer')) {
        const visibility = e.target.checked ? 'visible' : 'none';
        window.map.setLayoutProperty('hillshade-layer', 'visibility', visibility);
      }
    });
  }

  if (toggleTerrain) {
    toggleTerrain.addEventListener('change', (e) => {
      if (window.map) {
        if (e.target.checked && window.map.getSource('terrain')) {
          window.map.setTerrain({ source: 'terrain', exaggeration: 1.5 });
        } else {
          window.map.setTerrain(null);
        }
      }
    });
  }


  // Toggle logic for Waymarked Trails overlays (hiking / cycling)
  const toggleTrailsHiking = document.getElementById('toggleTrailsHiking');
  const toggleTrailsCycling = document.getElementById('toggleTrailsCycling');

  if (toggleTrailsHiking) {
    toggleTrailsHiking.addEventListener('change', (e) => {
      if (window.map && window.map.getLayer('waymarked-hiking-layer')) {
        const visibility = e.target.checked ? 'visible' : 'none';
        window.map.setLayoutProperty('waymarked-hiking-layer', 'visibility', visibility);
      }
    });
  }

  if (toggleTrailsCycling) {
    toggleTrailsCycling.addEventListener('change', (e) => {
      if (window.map && window.map.getLayer('waymarked-cycling-layer')) {
        const visibility = e.target.checked ? 'visible' : 'none';
        window.map.setLayoutProperty('waymarked-cycling-layer', 'visibility', visibility);
      }
    });
  }

  // Toggle logic for book boxes without photo (boites-a-livres.fr)
  const toggleBookBoxes = document.getElementById('toggleBookBoxes');
  if (toggleBookBoxes) {
    toggleBookBoxes.addEventListener('change', async (e) => {
      if (!window.map) return;
      const { setBoitesALivresVisibility } = await import('../mapdata/boitesALivres.js');
      setBoitesALivresVisibility(window.map, e.target.checked);
    });
  }

  // Map Settings Menu Toggle
  const mapSettingsToggle = document.getElementById('map-settings-toggle');
  const mapSettingsPanel = document.getElementById('map-settings-panel');
  const mapSettingsMenu = document.getElementById('map-settings-menu');
  
  if (mapSettingsToggle && mapSettingsPanel && mapSettingsMenu) {
    mapSettingsToggle.addEventListener('click', (e) => {
      console.debug('[UI] map settings toggle clicked');
      e.stopPropagation();
      mapSettingsPanel.classList.toggle('hidden');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!mapSettingsMenu.contains(e.target)) {
        mapSettingsPanel.classList.add('hidden');
      }
    });
  } else {
    console.warn('[UI] map settings elements missing:', { mapSettingsToggle, mapSettingsPanel, mapSettingsMenu });
  }

}


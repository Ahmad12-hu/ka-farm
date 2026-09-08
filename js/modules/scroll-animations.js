/**
 * KA Farm - Module d'Animations au Scroll
 * Utilise IntersectionObserver pour déclencher les animations au défilement
 * Respecte prefers-reduced-motion
 * Inspiré du style BenDJo - Animations fluides et modernes
 */

export class ScrollAnimations {
  constructor(options = {}) {
    this.observer = null;
    this.mutationObserver = null;
    this.options = {
      root: options.root || null,
      rootMargin: options.rootMargin || '0px 0px -50px 0px',
      threshold: options.threshold || 0.15,
      ...options
    };
    this.elements = [];
    this.isReducedMotion = this.checkReducedMotion();
    this.performanceMode = this.checkPerformanceMode();
  }

  /**
   * Vérifie si l'utilisateur a activé prefers-reduced-motion
   */
  checkReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Vérifie si on doit activer le mode performance
   */
  checkPerformanceMode() {
    // Détecter les appareils bas de gamme ou slow 4G
    const connection = navigator.connection;
    if (connection) {
      return connection.saveData || 
             (connection.effectiveType && connection.effectiveType.includes('2g'));
    }
    return false;
  }

  /**
   * Initialise l'IntersectionObserver
   */
  init() {
    // Si reduced-motion est activé, on désactive les animations
    if (this.isReducedMotion) {
      this.enableAllElements();
      return;
    }

    // Mode performance : utiliser des animations plus légères
    if (this.performanceMode) {
      this.options.rootMargin = '0px 0px -20px 0px';
      this.options.threshold = 0.3;
    }

    // Créer l'observer avec optimisation
    this.observer = new IntersectionObserver(
      (entries) => this.handleIntersection(entries),
      {
        root: this.options.root,
        rootMargin: this.options.rootMargin,
        threshold: this.options.threshold
      }
    );

    // Observer les éléments existants
    this.observeElements();

    // Observer les futurs éléments ajoutés dynamiquement
    this.observeMutations();

    console.log('[ScrollAnimations] Initialisé avec succès', {
      reducedMotion: this.isReducedMotion,
      performanceMode: this.performanceMode
    });
  }

  /**
   * Gère les entrées dans le viewport avec optimisation
   */
  handleIntersection(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Utiliser requestAnimationFrame pour de meilleures performances
        requestAnimationFrame(() => {
          entry.target.classList.add('is-visible');
          
          // Ajouter une classe spéciale pour les cartes
          if (entry.target.classList.contains('card-hover')) {
            entry.target.classList.add('card-hover-active');
          }
        });
        
        // Arrêter d'observer après l'animation pour économiser les ressources
        this.observer.unobserve(entry.target);
      }
    });
  }

  /**
   * Observe tous les éléments avec la classe .animate-on-scroll
   */
  observeElements() {
    const elements = document.querySelectorAll('.animate-on-scroll');
    elements.forEach(el => {
      // Marquer l'élément pour éviter les doublons
      if (!el.dataset.observed) {
        this.observer.observe(el);
        el.dataset.observed = 'true';
        this.elements.push(el);
      }
    });
  }

  /**
   * Active tous les éléments immédiatement (pour reduced-motion)
   */
  enableAllElements() {
    const elements = document.querySelectorAll('.animate-on-scroll');
    elements.forEach(el => {
      el.classList.add('is-visible');
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
  }

  /**
   * Surveille l'ajout de nouveaux éléments dans le DOM
   */
  observeMutations() {
    // Utiliser un debounce pour éviter trop de traitements
    let timeout;
    
    this.mutationObserver = new MutationObserver((mutations) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) { // Element node
              const newElements = node.querySelectorAll?.('.animate-on-scroll') || [];
              newElements.forEach(el => {
                if (!el.classList.contains('is-visible') && !el.dataset.observed) {
                  this.observer.observe(el);
                  el.dataset.observed = 'true';
                }
              });
              
              // Si le nœud lui-même a la classe
              if (node.classList?.contains('animate-on-scroll') && !node.dataset.observed) {
                this.observer.observe(node);
                node.dataset.observed = 'true';
              }
            }
          });
        });
      }, 100); // 100ms debounce
    });

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Détruit l'observer
   */
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
    
    // Nettoyer les données
    this.elements.forEach(el => {
      delete el.dataset.observed;
    });
    this.elements = [];
  }

  /**
   * Réinitialise l'observer (utile après des changements DOM majeurs)
   */
  refresh() {
    this.destroy();
    this.init();
  }

  /**
   * Anime manuellement un élément spécifique
   */
  animateElement(element) {
    if (this.isReducedMotion) {
      element.classList.add('is-visible');
      element.style.opacity = '1';
      element.style.transform = 'none';
      return;
    }
    
    requestAnimationFrame(() => {
      element.classList.add('is-visible');
    });
  }

  /**
   * Réinitialise un élément à son état initial
   */
  resetElement(element) {
    element.classList.remove('is-visible', 'card-hover-active');
    element.dataset.observed = 'false';
  }

  /**
   * Réinitialise tous les éléments
   */
  resetAll() {
    this.elements.forEach(el => {
      this.resetElement(el);
    });
  }

  /**
   * Anime une liste d'éléments avec un délai en cascade
   */
  animateList(elements, staggerDelay = 100) {
    elements.forEach((el, index) => {
      setTimeout(() => {
        this.animateElement(el);
      }, index * staggerDelay);
    });
  }
}

// Instance singleton
let scrollAnimationsInstance = null;

/**
 * Initialise les animations au scroll
 */
export function initScrollAnimations(options = {}) {
  if (scrollAnimationsInstance) {
    scrollAnimationsInstance.destroy();
  }
  
  scrollAnimationsInstance = new ScrollAnimations(options);
  scrollAnimationsInstance.init();
  
  return scrollAnimationsInstance;
}

/**
 * Obtient l'instance existante
 */
export function getScrollAnimations() {
  return scrollAnimationsInstance;
}

/**
 * Fonction helper pour ajouter des classes d'animation
 */
export function addAnimationClasses(element, type = 'default') {
  const classes = {
    'default': 'animate-on-scroll',
    'slide-left': 'animate-on-scroll slide-left',
    'slide-right': 'animate-on-scroll slide-right',
    'fade-only': 'animate-on-scroll fade-only',
    'card': 'animate-on-scroll card-hover',
    'reveal': 'animate-on-scroll reveal',
    'shimmer': 'animate-on-scroll shimmer'
  };
  
  element.classList.add(...(classes[type] || classes['default']).split(' '));
}

/**
 * Fonction helper pour ajouter des délais en cascade
 */
export function addStaggerDelay(element, index) {
  const delay = Math.min(index * 0.08, 0.4); // Max 0.4s de délai, plus rapide
  element.style.transitionDelay = `${delay}s`;
}

/**
 * Fonction helper pour animer des éléments dynamiques
 */
export function animateDynamicElements(container, selector = '.animate-on-scroll') {
  const elements = container.querySelectorAll(selector);
  const instance = getScrollAnimations();
  if (instance) {
    instance.animateList(Array.from(elements));
  }
}

// Auto-initialisation si le DOM est chargé
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initScrollAnimations();
  });
} else {
  initScrollAnimations();
}
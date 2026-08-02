let currentSlide = 0;
let slideInterval = null;

function startHeroSlider() {
  const slides = document.querySelectorAll('.hero-slider .slide');
  if (slides.length === 0) return;

  slideInterval = setInterval(() => {
    moveSlide(1);
  }, 5000);
}

function moveSlide(direction) {
  const slides = document.querySelectorAll('.hero-slider .slide');
  const dots = document.querySelectorAll('.hero-slider .dot');
  if (slides.length === 0) return;

  slides[currentSlide].classList.remove('active');
  dots[currentSlide].classList.remove('active');

  currentSlide = (currentSlide + direction + slides.length) % slides.length;

  slides[currentSlide].classList.add('active');
  dots[currentSlide].classList.add('active');
}

function setSlide(slideIndex) {
  const slides = document.querySelectorAll('.hero-slider .slide');
  const dots = document.querySelectorAll('.hero-slider .dot');
  if (slides.length === 0) return;

  slides[currentSlide].classList.remove('active');
  dots[currentSlide].classList.remove('active');

  currentSlide = slideIndex;

  slides[currentSlide].classList.add('active');
  dots[currentSlide].classList.add('active');

  clearInterval(slideInterval);
  startHeroSlider();
}

function toggleMobileMenu() {
  const nav = document.getElementById('pub-mobile-nav');
  nav.classList.toggle('active');
}

function toggleIntranetMenu(force) {
  const sidebar = document.querySelector('.intra-sidebar');
  const backdrop = document.getElementById('intra-menu-backdrop');
  if (!sidebar || !backdrop) return;
  const open = typeof force === 'boolean' ? force : !sidebar.classList.contains('active');
  sidebar.classList.toggle('active', open);
  backdrop.classList.toggle('active', open);
}

function filterFeatured(category) {
  const filterBtns = document.querySelectorAll('.filter-buttons .filter-btn');
  filterBtns.forEach(btn => btn.classList.remove('active'));

  const targetBtn = document.getElementById(`f-${category}`);
  if (targetBtn) targetBtn.classList.add('active');

  const projectCards = document.querySelectorAll('.projects-grid .project-card');
  projectCards.forEach(card => {
    if (category === 'all' || card.getAttribute('data-cat') === category) {
      card.style.display = 'block';
    } else {
      card.style.display = 'none';
    }
  });
}

function toggleBlueprintDrawer() {
  // The button itself is shown only after the signed-in server session is
  // identified as an administrator. Reuse that same UI gate here so legacy
  // role labels such as "인사팀 / 관리자" do not block an authorized click.
  const button = document.getElementById('btn-view-blueprint');
  if (!isAuthenticated || !button || button.hidden) return;
  const drawer = document.getElementById('blueprint-drawer');
  drawer.classList.toggle('active');
}

function changeBlueprintImage() {
  const selector = document.getElementById('blueprint-select');
  const viewer = document.getElementById('blueprint-img-viewer');
  const selection = selector.value;

  const images = {
    timesheet: './docs/images/timesheet_input_wireframe_1780702852142.png',
    manpower: './docs/images/manpower_analysis_wireframe_1780702887158.png',
    homepage: './docs/images/homepage_wireframe_desktop_1780702409608.png',
    intranet: './docs/images/intranet_wireframe_desktop_1780702434285.png',
    subpages: './docs/images/intranet_sub_pages_wireframe_1780702459207.png',
    mobile: './docs/images/mobile_wireframe_responsive_1780702486877.png'
  };

  viewer.src = images[selection] || '';
}

function initializeIntranetClock() {
  updateTime();
  setInterval(updateTime, 1000);
}

function switchUserRole(role) {
  const userName = document.getElementById('current-user-name');
  const userRole = document.getElementById('current-user-role');
  const roleLabel = document.getElementById('role-select');

  if (!userName || !userRole || !roleLabel) return;

  if (role === 'manager') {
    MOCK_DB.currentUser.name = '홍길동';
    MOCK_DB.currentUser.role = 'AA부서 / 과장';
    userName.textContent = '홍길동';
    userRole.textContent = 'AA부서 / 과장';
    roleLabel.value = 'manager';
  } else if (role === 'staff') {
    MOCK_DB.currentUser.name = '김철수';
    MOCK_DB.currentUser.role = '설계부서 / 사원';
    userName.textContent = '김철수';
    userRole.textContent = '설계부서 / 사원';
    roleLabel.value = 'staff';
  } else if (role === 'admin') {
    MOCK_DB.currentUser.name = '박민서';
    MOCK_DB.currentUser.role = '인사팀 / 관리자';
    userName.textContent = '박민서';
    userRole.textContent = '인사팀 / 관리자';
    roleLabel.value = 'admin';
  }

  saveAppState();

  if (activeSubView === 'approval') {
    renderApprovalsTable();
  }
  if (activeSubView === 'dashboard') {
    renderDashboardApprovals();
  }
}

function updateTime() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

  const dateDisplay = document.getElementById('live-date');
  const timeDisplay = document.getElementById('live-time');

  if (dateDisplay) dateDisplay.textContent = dateStr;
  if (timeDisplay) timeDisplay.textContent = timeStr;

  const attClock = document.getElementById('attendance-page-time');
  const quickClock = document.getElementById('quick-time-stamp');
  if (attClock) attClock.textContent = timeStr;
  if (quickClock) quickClock.textContent = timeStr;
}

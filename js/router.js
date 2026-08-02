let activeSubView = 'dashboard';

function switchMainView(viewType) {
  const pubView = document.getElementById('view-public');
  const intraView = document.getElementById('view-intranet');
  const btnPub = document.getElementById('btn-toggle-public');
  const btnIntra = document.getElementById('btn-toggle-intranet');

  if (viewType === 'intranet' && !isAuthenticated) {
    openAuthModal('login');
    return;
  }

  if (viewType === 'public') {
    pubView.classList.add('active');
    intraView.classList.remove('active');
    btnPub.classList.add('active');
    btnIntra.classList.remove('active');
  } else {
    pubView.classList.remove('active');
    intraView.classList.add('active');
    btnPub.classList.remove('active');
    btnIntra.classList.add('active');

    switchSubView('dashboard');
    initializeIntranetClock();
  }
  lucide.createIcons();
}

function switchSubView(subViewId) {
  toggleIntranetMenu(false);
  const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
  menuItems.forEach(item => item.classList.remove('active'));

  const targetMenu = document.getElementById(`menu-${subViewId}`);
  if (targetMenu) targetMenu.classList.add('active');

  const subViews = document.querySelectorAll('.intra-content .sub-view');
  subViews.forEach(view => view.classList.remove('active'));

  const targetView = document.getElementById(`sub-${subViewId}`);
  if (targetView) targetView.classList.add('active');

  const titleDisplay = document.getElementById('intra-page-title');
  const titles = {
    dashboard: '대시보드',
    timesheet: '투입시간 관리 (Timesheet Input)',
    manpower: '인력 투입 분석 (Manpower Allocation)',
    approval: '전자결재 문서함',
    attendance: '사내 근태 관리',
    admin: '사용자 승인',
    diary: '주간 업무일지'
  };
  titleDisplay.textContent = titles[subViewId] || '사내 시스템';

  activeSubView = subViewId;

  if (subViewId === 'dashboard') {
    renderDashboardApprovals();
  } else if (subViewId === 'timesheet') {
    renderTimesheet();
  } else if (subViewId === 'manpower') {
    renderManpowerAnalysis();
  } else if (subViewId === 'approval') {
    renderApprovalsTable();
  } else if (subViewId === 'diary') {
    renderDiaryWeekView();
  } else if (subViewId === 'attendance') {
    renderAttendancePageClock();
  } else if (subViewId === 'admin') {
    renderAdminPanel();
  }

  lucide.createIcons();
}

window.addEventListener('DOMContentLoaded', async () => {
  await window.appStateReady;
  initTimesheets();
  startHeroSlider();
  await initializeAuth();
  if (isAuthenticated) {
    await verifyDatabaseHealth();
    await hydrateWorkflowsFromNeon();
  }
  switchMainView('public');
  lucide.createIcons();
});

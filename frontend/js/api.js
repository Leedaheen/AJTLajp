/**
 * API 통신 모듈
 * 모든 fetch 요청은 이 모듈을 통해 처리합니다.
 * 인증 토큰 자동 첨부, 오프라인 감지, 에러 처리를 담당합니다.
 */

// 배포 시 실제 백엔드 URL로 변경하세요
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:8000/api'
  : '/api';

const Api = (() => {
  function getToken() {
    return localStorage.getItem('app_token');
  }

  async function request(method, path, body = null, opts = {}) {
    const silent = opts.silent === true;

    // 오프라인 체크
    if (!navigator.onLine) {
      if (!silent) Toast.error('현재 오프라인 상태입니다. 인터넷 연결 후 다시 시도해 주세요.');
      throw new Error('OFFLINE');
    }

    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    try {
      const res = await fetch(`${API_BASE}${path}`, options);

      if (res.status === 401) {
        Auth.logout();
        return;
      }
      if (res.status === 403) {
        if (!silent) Toast.error('접근 권한이 없습니다. 관리자에게 문의하세요.');
        throw new Error('FORBIDDEN');
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || '서버 오류가 발생했습니다.');
      }

      return await res.json();
    } catch (e) {
      if (e.message === 'OFFLINE' || e.message === 'FORBIDDEN') throw e;
      if (!silent) {
        if (e.name === 'TypeError') {
          Toast.error('네트워크 연결을 확인해주세요.');
        } else {
          Toast.error(e.message);
        }
      }
      throw e;
    }
  }

  return {
    get:    (path, opts)        => request('GET',    path, null, opts),
    post:   (path, body, opts)  => request('POST',   path, body, opts),
    patch:  (path, body, opts)  => request('PATCH',  path, body, opts),
    delete: (path, opts)        => request('DELETE', path, null, opts),
  };
})();

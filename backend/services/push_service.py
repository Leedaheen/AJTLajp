"""
PWA Web Push 발송 서비스
Firebase 없이 VAPID 키만으로 동작합니다.
"""
import json
from pywebpush import webpush, WebPushException
from config import VAPID_PRIVATE_KEY, VAPID_EMAIL


def send_push(subscription: dict, title: str, body: str, url: str = "/") -> bool:
    """
    단일 구독자에게 Push 알림을 발송합니다.
    subscription: app_users.push_sub 컬럼값 (endpoint/keys 포함 dict)
    """
    if not VAPID_PRIVATE_KEY or not subscription:
        return False
    try:
        webpush(
            subscription_info=subscription,
            data=json.dumps({"title": title, "body": body, "url": url}),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_EMAIL},
        )
        return True
    except WebPushException as e:
        # 구독이 만료된 경우 (410 Gone) 조용히 처리
        if e.response and e.response.status_code in (404, 410):
            return False
        raise

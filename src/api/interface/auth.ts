import request from "@/core/request";
import { memoryTokenManager } from "@/core/token/token";

// 手机otp登錄
export function loginBySmsOtp(data: InternalAuth.LoginBySmsOtpForm) {
  return request<InternalToken.Token>({
    url: "/token/sms-otp",
    method: "POST",
    ignoreAuth: true,
    data,
  });
}

// 手機號與登入密碼登錄
export function loginByPassword(data: InternalAuth.LoginByPassword) {
  return request<InternalToken.Token>({
    url: "/token/password",
    method: "POST",
    ignoreAuth: true,
    data,
  });
}

// 刷新token
export function refreshToken(data: InternalAuth.RefreshTokenForm) {
  return request<InternalToken.Token>({
    url: "/token",
    method: "PUT",
    ignoreAuth: true,
    data,
  });
}

// 登出
export function logout() {
  return request({ url: "/token", method: "DELETE" });
}


memoryTokenManager.setRefreshToken(async (prevToken: InternalToken.Token) => {
  const res = refreshToken({refreshToken: prevToken.refresh}).catch(errRes => errRes)
  return res;
})
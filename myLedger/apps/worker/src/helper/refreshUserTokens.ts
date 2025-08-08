import { login } from "@repo/puppeteer_utils/login";

export const refreshUserToken = async (username: string, password: string) => {
  try {
    const {
      isFailedCaptcha,
      captchaText,
      currentUrl,
      isLoginSuccessful,
      message,
      token,
    } = await login(username, password);

    console.log("this is ", token, isLoginSuccessful);
  } catch (error) {
    throw error;
  }
};

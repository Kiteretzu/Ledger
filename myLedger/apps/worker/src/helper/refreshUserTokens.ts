import { login } from "@repo/puppeteer_utils/login";
import { client as prisma } from "@repo/db/client"; // Adjust the import path as necessary

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

    const updatedToken = await prisma.user.update({
      where: { username },
      data: {
        token,
        tokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // Set expiry to 24 hours from now
      },
    });

    console.log("Token updated successfully for user:", username);
  } catch (error) {
    throw error;
  }
};

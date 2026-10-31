import type { SignInSignalValue, SignUpSignalValue } from '@clerk/shared/types';
import type { ImperativeRouter } from 'expo-router/build/imperative-api';

import { SIGNED_IN_HOME } from '@/lib/routes';

export type AuthFlowError = Readonly<{
  message: string;
}>;

function getClerkErrorMessage(error: { message?: string } | null): string {
  return error?.message ?? 'Something went wrong. Please try again.';
}

export async function startSignUpEmailOtp(
  signUp: SignUpSignalValue['signUp'],
  params: Readonly<{ emailAddress: string; firstName: string }>,
): Promise<AuthFlowError | null> {
  const { error: createError } = await signUp.create({
    emailAddress: params.emailAddress,
    firstName: params.firstName,
  });

  if (createError) {
    return { message: getClerkErrorMessage(createError) };
  }

  const { error: sendError } = await signUp.verifications.sendEmailCode();

  if (sendError) {
    return { message: getClerkErrorMessage(sendError) };
  }

  return null;
}

export async function resendSignUpEmailOtp(
  signUp: SignUpSignalValue['signUp'],
): Promise<AuthFlowError | null> {
  const { error } = await signUp.verifications.sendEmailCode();

  if (error) {
    return { message: getClerkErrorMessage(error) };
  }

  return null;
}

export async function verifySignUpEmailOtp(
  signUp: SignUpSignalValue['signUp'],
  code: string,
  router: ImperativeRouter,
): Promise<AuthFlowError | null> {
  const { error } = await signUp.verifications.verifyEmailCode({ code });

  if (error) {
    return { message: getClerkErrorMessage(error) };
  }

  if (signUp.status === 'complete') {
    await signUp.finalize({
      navigate: ({ session, decorateUrl }) => {
        if (session?.currentTask) {
          return;
        }

        router.replace(SIGNED_IN_HOME);
      },
    });
    return null;
  }

  return { message: 'Sign-up is not complete yet. Please try again.' };
}

export async function startSignInEmailOtp(
  signIn: SignInSignalValue['signIn'],
  emailAddress: string,
): Promise<AuthFlowError | null> {
  const { error: createError } = await signIn.create({
    identifier: emailAddress,
  });

  if (createError) {
    return { message: getClerkErrorMessage(createError) };
  }

  const { error: sendError } = await signIn.emailCode.sendCode();

  if (sendError) {
    return { message: getClerkErrorMessage(sendError) };
  }

  return null;
}

export async function resendSignInEmailOtp(
  signIn: SignInSignalValue['signIn'],
): Promise<AuthFlowError | null> {
  const { error } = await signIn.emailCode.sendCode();

  if (error) {
    return { message: getClerkErrorMessage(error) };
  }

  return null;
}

export async function verifySignInEmailOtp(
  signIn: SignInSignalValue['signIn'],
  code: string,
  router: ImperativeRouter,
): Promise<AuthFlowError | null> {
  const { error } = await signIn.emailCode.verifyCode({ code });

  if (error) {
    return { message: getClerkErrorMessage(error) };
  }

  if (signIn.status === 'complete') {
    await signIn.finalize({
      navigate: ({ session, decorateUrl }) => {
        if (session?.currentTask) {
          return;
        }

        router.replace(SIGNED_IN_HOME);
      },
    });
    return null;
  }

  return { message: 'Sign-in is not complete yet. Please try again.' };
}

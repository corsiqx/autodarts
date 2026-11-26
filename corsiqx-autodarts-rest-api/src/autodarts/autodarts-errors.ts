import {
  BadGatewayException,
  ForbiddenException,
  HttpException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AutodartsAuthError } from './autodarts-auth.client';

/** Maps a failed Autodarts login or refresh to the API's `{ code, message }` errors. */
export function autodartsAuthHttpError(
  error: AutodartsAuthError,
): HttpException {
  switch (error.code) {
    case 'invalid_credentials':
    case 'invalid_token':
      return new UnprocessableEntityException({
        code: 'autodarts_invalid_credentials',
        message: 'Autodarts hat E-Mail oder Passwort abgelehnt.',
      });
    case 'consent_required':
      return autodartsConsentRequired();
    default:
      return autodartsUnavailable();
  }
}

export function autodartsConsentRequired(): ForbiddenException {
  return new ForbiddenException({
    code: 'autodarts_consent_required',
    message:
      'Bitte akzeptiere zuerst die neuen Bedingungen auf play.autodarts.com.',
  });
}

export function autodartsUnavailable(): BadGatewayException {
  return new BadGatewayException({
    code: 'autodarts_unavailable',
    message: 'Autodarts ist gerade nicht erreichbar.',
  });
}

/** Runs an Autodarts auth call and turns its errors into HTTP errors. */
export async function withAutodartsAuthErrors<T>(
  call: () => Promise<T>,
): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof AutodartsAuthError) {
      throw autodartsAuthHttpError(error);
    }
    throw error;
  }
}

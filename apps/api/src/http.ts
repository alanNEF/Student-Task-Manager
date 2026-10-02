import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import type { ApiConfig } from './config';

@Catch()
class SafeExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const bodyError =
      exception && typeof exception === 'object' && 'type' in exception
        ? exception.type
        : null;
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : bodyError === 'entity.parse.failed'
          ? 400
          : bodyError === 'entity.too.large'
            ? 413
            : 500;
    const payload =
      exception instanceof HttpException ? exception.getResponse() : null;
    const message =
      typeof payload === 'string'
        ? payload
        : payload && typeof payload === 'object' && 'message' in payload
          ? payload.message
          : status === 400
            ? 'Request body must contain valid JSON.'
            : status === 413
              ? 'Request body is too large.'
              : 'An unexpected error occurred. Please try again.';
    response.status(status).json({ statusCode: status, message });
  }
}

export function configureHttp(
  app: NestExpressApplication,
  config: ApiConfig,
): void {
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.enableCors({
    origin: config.frontendUrl,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  });
  app.useBodyParser('json', { limit: '128kb' });
  app.use(
    (
      error: unknown,
      _request: Request,
      response: Response,
      next: NextFunction,
    ) => {
      const type =
        error && typeof error === 'object' && 'type' in error
          ? error.type
          : null;
      if (type === 'entity.parse.failed') {
        response.status(400).json({
          statusCode: 400,
          message: 'Request body must contain valid JSON.',
        });
      } else if (type === 'entity.too.large') {
        response
          .status(413)
          .json({ statusCode: 413, message: 'Request body is too large.' });
      } else {
        next(error);
      }
    },
  );
  app.useGlobalFilters(new SafeExceptionFilter());
}

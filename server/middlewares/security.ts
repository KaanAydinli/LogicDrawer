import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import xssFilters from 'xss-filters';
import hpp from 'hpp';

/**
 * Tüm güvenlik middleware'lerini tek bir fonksiyonda birleştiren yapı
 */
export const configureSecurityMiddleware = (app: any) => {
  // HTTP güvenlik başlıkları - Helmet
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false
  }));
  
  // Brute force koruması için rate limiting
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 dakika
    max: 10, // IP başına maksimum istek sayısı
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Çok fazla giriş denemesi yapıldı. Lütfen 15 dakika sonra tekrar deneyin.'
  });
  
  // Auth rotalarına rate limiter uygulama
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
  
  // Genel API rate limiter
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 dakika
    max: 100, // IP başına maksimum istek sayısı
    standardHeaders: true,
    legacyHeaders: false
  });
  
  app.use('/api', apiLimiter);
  
  // NoSQL enjeksiyon saldırılarına karşı koruma
  app.use(mongoSanitize());
  
  // HTTP Parameter Pollution koruması
  app.use(hpp());
  
  // Güvenlik başlıkları
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });
};

/**
 * XSS koruması için string sanitize fonksiyonu
 * xss-clean yerine xss-filters kullanıyoruz
 */
export const sanitizeString = (str: string): string => {
  return xssFilters.inHTMLData(str);
};

/**
 * Input temizleme fonksiyonu
 */
export const sanitizeObject = (obj: any): any => {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeObject(value);
    } else {
      result[key] = value;
    }
  }
  
  return result;
};
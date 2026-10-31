import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtOrApiKeyGuard } from './guards/jwt-or-api-key.guard';
import { ScopesGuard } from './guards/scopes.guard';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.accessSecret'),
        signOptions: {
          expiresIn: '15m',
        },
      }),
    }),
    forwardRef(() => ApiKeysModule),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtOrApiKeyGuard, ScopesGuard],
  exports: [
    AuthService,
    JwtModule,
    PassportModule,
    JwtOrApiKeyGuard,
    ScopesGuard,
  ],
})
export class AuthModule {}

import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { ConfigModule } from "@nestjs/config"
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forRoot("mongodb+srv://cayrouniformes38:KtexduxLcm4yQK3u@cluster0.n6tir.mongodb.net/cayrodb?retryWrites=true&w=majority&appName=Cluster0"),
    UsersModule,
    AuthModule,
  ],
  controllers: [],
  providers: [AppService],
})
export class AppModule { }

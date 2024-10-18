import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateUserDto extends PartialType(CreateUserDto) {

}

export class PasswordUpdate{
    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    @MaxLength(50)
    password: string;
    
    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    @MaxLength(50)
    currentPassword: string;
}

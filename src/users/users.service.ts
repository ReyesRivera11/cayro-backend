import { BadRequestException, ConflictException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { PasswordUpdate, UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './schemas/User.Schema';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import axios from 'axios';
import { Role } from 'src/auth/roles/role.enum';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class UsersService {
  private codes = new Map<string, { code: string; expires: number }>();
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private jwtSvc: JwtService,
  ) {

  }
  async sendEmail(correo, subject, html) {
    var transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'cayrouniformes38@gmail.com',
        pass: 'wmye lboq uzjw kbtv'
      }
    });

    var mailOptions = {
      from: 'cayrouniformes38@gmail.com',
      to: correo,
      subject: subject,
      html: html
    };

    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log(error);
      } else {
        return ({ status: 'success' });
      }
    });
  }
  async sendCode(email: string) {
    try {
      const verificationCode = crypto.randomInt(100000, 999999).toString();
      //5 minutes 
      this.codes.set(email, { code: verificationCode, expires: Date.now() + 300000 });
      const currentYear = new Date().getFullYear(); // Obtener el año actual
      const html = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verificación de Cuenta Cayro</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
                <tr>
                    <td align="center" >
                        <img src="https://res.cloudinary.com/dhhv8l6ti/image/upload/v1728748461/logo.png" alt="Cayro Uniformes" style="display: block; width: 150px; max-width: 100%; height: auto;">
                    </td>
                </tr>
                <tr>
                    <td style="padding: 0px 30px;">
                        <h1 style="color: #333333; font-size: 24px; margin-bottom: 20px; text-align: center;">Verifica tu cuenta de Cayro</h1>
                        <p style="color: #666666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
                            Hola,
                        </p>
                        <p style="color: #666666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
                            Gracias por registrarte en Cayro Uniformes. Para completar tu registro, por favor utiliza el siguiente código de verificación:
                        </p>
                        <div style="background-color: #f0f0f0; border-radius: 4px; padding: 20px; text-align: center; margin-bottom: 20px;">
                            <span style="font-size: 32px; font-weight: bold; color: #0099FF; letter-spacing: 5px;">${verificationCode}</span>
                        </div>
                        <p style="color: #666666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
                            Ingresa este código en la página de verificación para activar tu cuenta. Si no has solicitado esta verificación, por favor ignora este correo.
                        </p>
                        <p style="color: #666666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
                            Este código expirará en 5 minutos por razones de seguridad.
                        </p>
                        <p style="color: #666666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
                            Si tienes alguna pregunta, no dudes en contactarnos.
                        </p>
                        <p style="color: #666666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
                            Saludos,<br>
                            El equipo de Cayro Uniformes
                        </p>
                    </td>
                </tr>
                <tr>
                    <td style="background-color: #27272A; padding: 20px 30px;">
                        <p style="color: #ffffff; font-size: 14px; line-height: 1.5; margin: 0; text-align: center;">
                            © ${currentYear} Cayro Uniformes. Todos los derechos reservados.
                        </p>
                        <p style="color: #ffffff; font-size: 14px; line-height: 1.5; margin: 10px 0 0; text-align: center;">
                            <a href="#" style="color: #ffffff; text-decoration: none;">Política de Privacidad</a> | 
                            <a href="#" style="color: #ffffff; text-decoration: none;">Términos de Servicio</a>
                        </p>
                    </td>
                </tr>
            </table>
        </body>
        </html>
      `
      await this.sendEmail(email, "Codigo de verificación", html);
      return { message: "Codigo de verificación enviado." }
    } catch (error) {
      console.log(error)
    }
  }
  async isPasswordCompromised(password: string): Promise<boolean> {
    const hashedPassword = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = hashedPassword.slice(0, 5);
    const suffix = hashedPassword.slice(5);
    try {
      const response = await axios.get(`https://api.pwnedpasswords.com/range/${prefix}`);
      const breachedPasswords = response.data.split('\n');

      for (let entry of breachedPasswords) {
        const [hashSuffix, count] = entry.split(':');
        if (hashSuffix === suffix) {
          return true; // Contraseña comprometida
        }
      }
      return false; // Contraseña segura
    } catch (error) {
      console.error('Error verificando contraseña comprometida:', error);
      return false; // Por precaución, devolver que no está comprometida en caso de error
    }
  }
  async create(createUserDto: CreateUserDto) {
    try {
      const userFound = await this.userModel.findOne({ email: createUserDto.email });
      if (userFound) throw new ConflictException("El correo ya esta en uso.");
      const compromised = await this.isPasswordCompromised(createUserDto.password);
      if (compromised) {
        throw new ConflictException("Esta contraseña ha sido comprometida. Por favor elige una diferente.");
      }
      const hashPassword = await bcrypt.hash(createUserDto.password, 10);

      const res = new this.userModel({ ...createUserDto, password: hashPassword, active: false });
      res.passwordsHistory.push({ password: hashPassword, createdAt: new Date() });
      await res.save();
      this.sendCode(createUserDto.email);
      return res;
    } catch (error) {
      console.log(error)
    }
  }

  async verifyCode(userEmail: string, code: string) {

    const record = this.codes.get(userEmail);
    const userFound = await this.userModel.findOne({ email: userEmail, active: false });
    if (!userFound) throw new NotFoundException("El usuario no se encuentra registrado o su cuenta ya esta activa.");

    if (!record || record.expires < Date.now()) {
      throw new ConflictException('El codigo ha expirado o es invalido.');
    }

    if (record.code !== code) {
      throw new ConflictException('Codigo invalido.');
    }

    // Código verificado, remover el código de la memoria
    this.codes.delete(userEmail);

    // Proceder con el registro o login
    await this.userModel.findOneAndUpdate({ email: userEmail, active: false }, { active: true });
    return { message: 'Codigo verificado exitosamente!' };

  }
  async updatePassword(id: string, updatePasswordDto: PasswordUpdate) {
    try {
      const userFound = await this.userModel.findById(id);

      if (!userFound) throw new NotFoundException("El usuario no se encuentra registrado.");

      const compromised = await this.isPasswordCompromised(updatePasswordDto.password);
      if (compromised) {
        throw new ConflictException("Esta contraseña ha sido comprometida. Por favor elige una diferente.");
      };
      const isMatch = bcrypt.compareSync(updatePasswordDto.currentPassword, userFound.password);

      if (!isMatch) {
        throw new ConflictException("La contraseña actual es incorrecta, por favor intenta de nuevo.");
      }

      const isInHistory = userFound.passwordsHistory.some(entry =>
        bcrypt.compareSync(updatePasswordDto.password, entry.password)
      );
      if (isInHistory) {
        throw new ConflictException('No puedes reutilizar contraseñas anteriores.');
      }

      const hashPassword = await bcrypt.hash(updatePasswordDto.password, 10);

      const currentDate = new Date();
      const newPasswordExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

      userFound.password = hashPassword;
      userFound.passwordSetAt = currentDate;
      userFound.passwordExpiresAt = newPasswordExpiresAt;

      userFound.passwordsHistory.push({
        password: hashPassword,
        createdAt: currentDate
      });


      if (userFound.passwordsHistory.length > 5) {
        userFound.passwordsHistory.shift();
      }
      await userFound.save();
      return userFound;
    } catch (error) {
      console.log(error)
    }
  }

  async recoverPassword(email: string) {
    try {
      const userFound = await this.userModel.findOne({ email });
      if (!userFound) throw new NotFoundException(`El correo ${email} no se encuentra registrado.`);
      const payload = { sub: userFound._id, role: Role.USER };
      const token = this.jwtSvc.sign(payload, { expiresIn: "5m" });
      const currentYear = new Date().getFullYear();
      const html = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Recupera tu contraseña de tu cuenta en Cayro</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
                <tr>
                    <td align="center" >
                        <img src="https://res.cloudinary.com/dhhv8l6ti/image/upload/v1728748461/logo.png" alt="Cayro Uniformes" style="display: block; width: 150px; max-width: 100%; height: auto;">
                    </td>
                </tr>
                <tr>
                    <td style="padding: 0px 30px;">
                        <h1 style="color: #333333; font-size: 24px; margin-bottom: 20px; text-align: center;">Verifica tu cuenta de Cayro</h1>
                        <p style="color: #666666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
                            Hola,
                        </p>
                        <p style="color: #666666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
                            Si has solicitado recuperar tu contraseña, por favor utiliza el siguiente enlace para restablecerla:
                        </p>

                        <div style="background-color: #f0f0f0; border-radius: 4px; padding: 20px; text-align: center; margin-bottom: 20px;">
                            <a href="http://localhost:5173/change-password/${token}" style="font-size: 32px; font-weight: bold; color: #0099FF;">Recuperar contraseña</a>
                        </div>
                        <p style="color: #666666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
                            Si no has solicitado esta recuperación, por favor ignora este correo.
                        </p>
                        <p style="color: #666666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
                            Este enlace expirará en 5 minutos por razones de seguridad.
                        </p>
                        <p style="color: #666666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
                            Si tienes alguna pregunta, no dudes en contactarnos.
                        </p>
                        <p style="color: #666666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
                            Saludos,<br>
                            El equipo de Cayro Uniformes
                        </p>
                    </td>
                </tr>
                <tr>
                    <td style="background-color: #27272A; padding: 20px 30px;">
                        <p style="color: #ffffff; font-size: 14px; line-height: 1.5; margin: 0; text-align: center;">
                            © ${currentYear} Cayro Uniformes. Todos los derechos reservados.
                        </p>
                        <p style="color: #ffffff; font-size: 14px; line-height: 1.5; margin: 10px 0 0; text-align: center;">
                            <a href="#" style="color: #ffffff; text-decoration: none;">Política de Privacidad</a> | 
                            <a href="#" style="color: #ffffff; text-decoration: none;">Términos de Servicio</a>
                        </p>
                    </td>
                </tr>
            </table>
        </body>
        </html>
      `
      this.sendEmail(email,"Recuperar contraseña",html);
      return { message: "Codigo de verificación enviado." }
    } catch (error) {
      console.log(error)
    }
  }

  findAll() {
    return `This action returns all users`;
  }

  findOne(id: number) {
    return `This action returns a #${id} user`;
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}

import { ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException, Request } from '@nestjs/common';
import { LoginDto } from './dto/login-auth.dto';
import { InjectModel } from '@nestjs/mongoose';
import { User } from 'src/users/schemas/User.Schema';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Role } from './roles/role.enum';
import { UsersService } from 'src/users/users.service';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';

@Injectable()
export class AuthService {
  private codes = new Map<string, { code: string; expires: number }>();
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private jwtSvc: JwtService,
    private readonly usersService: UsersService,
  ) { }

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
  async verifyCode(userEmail: string, code: string) {

    const record = this.codes.get(userEmail);
    const userFound = await this.userModel.findOne({ email: userEmail });
    if (!userFound) throw new NotFoundException("El usuario no se encuentra registrado o su cuenta esta inactiva.");

    if (!record || record.expires < Date.now()) {
      throw new ConflictException('El codigo ha expirado o es invalido.');
    }

    if (record.code !== code) {
      throw new ConflictException('Codigo invalido.');
    }

    this.codes.delete(userEmail);
    let expiresIn: any;
    switch (userFound.role) {
      case Role.ADMIN:
        expiresIn = '8h'; // Por ejemplo, 7 días para administradores
        break;
      case Role.USER:
        expiresIn = '1d'; // 1 día para usuarios regulares
        break;
      case Role.EMPLOYEE:
        expiresIn = '4h'; // 1 hora para invitados
        break;
      default:
        expiresIn = '1h'; // Valor por defecto
    }
    const { password, ...rest } = userFound.toObject();
    const payload = { sub: userFound._id, role: Role.USER };
    const token = this.jwtSvc.sign(payload, { expiresIn });
    return { user: { ...rest, role: Role.USER }, token }

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
                            Para completar tu autentidicación, por favor utiliza el siguiente código de verificación:
                        </p>
                        <div style="background-color: #f0f0f0; border-radius: 4px; padding: 20px; text-align: center; margin-bottom: 20px;">
                            <span style="font-size: 32px; font-weight: bold; color: #0099FF; letter-spacing: 5px;">${verificationCode}</span>
                        </div>
                        <p style="color: #666666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
                            Ingresa este código en la página de verificación para verificar tu autentificación. Si no has solicitado esta verificación, por favor ignora este correo.
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
  async login(loginDto: LoginDto) {
    const userFound = await this.userModel.findOne({ email: loginDto.email });
    if (!userFound) throw new NotFoundException("Usuario no registrado.");

    if (userFound.lockUntil > new Date()) {
      const now = new Date();
      const timeDifference = userFound.lockUntil.getTime() - now.getTime(); // Diferencia en milisegundos

      // Calcular los minutos y segundos restantes
      const minutesRemaining = Math.floor(timeDifference / (1000 * 60)); // Convertir a minutos
      const secondsRemaining = Math.floor((timeDifference % (1000 * 60)) / 1000); // Restante en segundos

      // Construir el mensaje dinámico
      let formattedMessage = '';
      if (minutesRemaining > 0) {
        formattedMessage = `${minutesRemaining} minutos y ${secondsRemaining} segundos`;
      } else {
        formattedMessage = `${secondsRemaining} segundos`; // Solo mostrar segundos si los minutos son 0
      }
      throw new ForbiddenException('Cuenta bloqueada temporalmente. Inténtalo de nuevo en ' + formattedMessage);
    }
    const isPasswordValid = await bcrypt.compare(loginDto.password, userFound.password);

    if (!isPasswordValid) {
      userFound.loginAttempts = (userFound.loginAttempts || 0) + 1;

      if (userFound.loginAttempts === 3) userFound.lockUntil = new Date(Date.now() + 5 * 60 * 1000);

      if (userFound.loginAttempts === 5) {
        userFound.lockUntil = new Date(Date.now() + 10 * 60 * 1000);
        userFound.loginAttempts = 0;
      }

      await userFound.save();

      throw new HttpException("La contraseña es incorrecta.", HttpStatus.UNAUTHORIZED);
    }

    userFound.loginAttempts = 0;
    await userFound.save();
    if (userFound.role === Role.USER && userFound.active === true) {
      this.sendCode(loginDto.email);
    }
    const { password, ...rest } = userFound.toObject();
    return { ...rest }
  }

  async verifyToken(@Request() request,) {
    try {
      const user = await this.userModel.findById(request.sub);
      // const admin = !user && await this.adminModel.findById(request.sub);
      // const employee = !user && !admin && await this.profesorModel.findById(request.sub);

      // if (user || admin || employee) {
      if (user ) {
        // const entity = user || admin || employee;
        const entity = user;
        const { password, ...rest } = entity.toObject();
        // return { ...rest, role: user ? Role.ALUMNO : admin ? Role.ADMIN : Role.employee, };
        return { ...rest, role: Role.USER  };
      }
      throw new NotFoundException("El usuario no se encuentra registrado");

    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Error interno del servidor', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}

import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  ConnectedSocket, MessageBody, OnGatewayInit, OnGatewayDisconnect
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { MessagesService } from './messages.service';
import { Logger } from '@nestjs/common';

@WebSocketGateway({ cors: { origin: '*' }, namespace: 'messages' })
export class MessagesGateway implements OnGatewayInit, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(MessagesGateway.name);

  constructor(
    private readonly messagesService: MessagesService,
    private readonly jwtService: JwtService,
  ) {}

  afterInit() {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join-project')
  async handleJoinProject(@ConnectedSocket() client: Socket, @MessageBody() data: { projectId: string; token: string }) {
    try {
      const payload = this.jwtService.verify(data.token);
      client.data.userId = payload.sub;
      client.join(`project:${data.projectId}`);
      client.emit('joined', { projectId: data.projectId });
    } catch {
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect();
    }
  }

  @SubscribeMessage('send-message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string; content: string },
  ) {
    const userId = client.data.userId;
    if (!userId) return;

    try {
      const message = await this.messagesService.send(data.projectId, userId, data.content);
      this.server.to(`project:${data.projectId}`).emit('new-message', message);
    } catch (e) {
      client.emit('error', { message: e.message });
    }
  }
}

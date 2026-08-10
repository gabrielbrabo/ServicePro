import { CashSession } from "../models/CashSession";
import { CashMovement } from "../models/CashMovement";
import { IBooking } from "../models/Booking";
import { Booking } from "../models/Booking";
import { Service } from "../models/Service";
import { Types } from "mongoose";

// Lanca um booking concluido como ENTRADA na sessao de caixa informada.
// - so lanca se ainda nao foi lancado (payment.postedToCash === false)
// - usa a forma de pagamento gravada no booking (payment.method)
// - copia o professional do booking para o movimento
// - marca payment.postedToCash = true no booking
//
// Retorna true se lancou, false se nao (ja lancado / sem method valido).
export const postBookingToCash = async (
  booking: IBooking,
  sessionId: Types.ObjectId,
  postedBy: Types.ObjectId | string
): Promise<boolean> => {
  // ja lancado? nao repete
  if (booking.payment.postedToCash) return false;

  // sem forma de pagamento valida, nao lanca (nao sabe o metodo)
  const method = booking.payment.method;
  const validMethods = ["dinheiro", "cartao", "pix", "outro"];
  if (!method || !validMethods.includes(method)) return false;

  // descricao amigavel com o titulo do servico
  let serviceTitle = "Serviço";
  const svc = await Service.findById(booking.service).select("title");
  if (svc?.title) serviceTitle = svc.title;

  try {
    await CashMovement.create({
      session: sessionId,
      establishment: booking.establishment,
      createdBy: postedBy,
      type: "entrada",
      method: method as "dinheiro" | "cartao" | "pix" | "outro",
      amount: booking.payment.amount,
      description: serviceTitle,
      booking: booking._id,
      professional: booking.professional ?? null,
    });
  } catch (err: unknown) {
    // colisao do indice unico de booking = ja foi lancado por outra via
    if ((err as { code?: number })?.code === 11000) {
      await Booking.updateOne(
        { _id: booking._id },
        { $set: { "payment.postedToCash": true } }
      );
      return false;
    }
    throw err;
  }

  // marca o booking como lancado
  booking.payment.postedToCash = true;
  await booking.save();
  return true;
};

// Varre TODOS os bookings concluidos + nao lancados do estabelecimento
// (independente da data) e lanca cada um na sessao. Usado ao abrir o caixa.
//
// (Mantem o nome antigo por compatibilidade com quem chama; o parametro
// referenceDate nao e mais usado no filtro, mas fica na assinatura para
// nao quebrar a chamada existente no cashController.)
export const postPendingBookingsForDate = async (
  establishmentId: Types.ObjectId | string,
  sessionId: Types.ObjectId,
  _referenceDate: Date,
  postedBy: Types.ObjectId | string
): Promise<number> => {
  const pendentes = await Booking.find({
    establishment: establishmentId,
    status: "concluido",
    "payment.postedToCash": false,
  });

  let count = 0;
  for (const b of pendentes) {
    const posted = await postBookingToCash(b, sessionId, postedBy);
    if (posted) count++;
  }
  return count;
};
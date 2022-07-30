const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const pagamentoSchema = new mongoose.Schema({
    _id: Number,
    server_id: String,
    user_id: String,
    pagamento_confirmado: Boolean,
    data: String,
    quantidade_produtos_vendidos: Number,
    valor: Number,
});

const produtoSchema = new mongoose.Schema({
    _id: Number,
    server_id: String,
    nome: String,
    valor: Number,
    quantidade: { type: Number, default: 0 }
}, { _id: false });

produtoSchema.plugin(AutoIncrement);


const produtoEstoqueSchema = new mongoose.Schema({
    produtoId: Number,
    server_id: String,
    conteudo: String,
    data_adicao: Number,
});

const msgProdutoSchema = new mongoose.Schema({
    canal_id: String,
    msg_id: String,
    server_id: String,
    produtoId: Number,
});

const carrinhoSchema = new mongoose.Schema({
    server_id: String,
    user_id: String,
    msg_carrinho_status: String,
    produtos: [
        // Produtos no carrinho da pessoa
        {
            msg_produto_id: String,
            produto_id: Number,
            produto_nome: String,
            produto_conteudo: String,
            produto_valor: Number,
            produto_data_adicao: Number,
        }
    ]
});

const produtoVendidoSchema = new mongoose.Schema({
    server_id: String,
    quantidade: { type: Number, default: 0 },
    data: Number,
    id: Number,
    nome: String, // Usado quando o id do produto for apagado
});

module.exports.Pagamento = mongoose.model('pagamento', pagamentoSchema);
module.exports.Produto = mongoose.model('produto', produtoSchema);
module.exports.ProdutoEstoque = mongoose.model('produto_estoque', produtoEstoqueSchema);
module.exports.MsgProduto = mongoose.model('mensagem_produto', msgProdutoSchema);
module.exports.Carrinho = mongoose.model('carrinho', carrinhoSchema);
module.exports.ProdutoVendido = mongoose.model('produto_vendido', produtoVendidoSchema);

// eslint-disable-next-line no-unused-vars
const { ButtonInteraction, MessageAttachment, MessageEmbed, MessageButton, MessageActionRow, Collection } = require('discord.js');
const { Buffer }  = require('buffer');
const { Pagamento, Carrinho, ProdutoVendido } = require('../models/vendas');
const mercadopago = require('mercadopago');
const { accessToken, canalLogs } = require('../config.json');

mercadopago.configure({
    access_token: accessToken
});

/**
 * @typedef {Object} ProdutoCarrinho
 * @property {String} msg_produto_id
 * @property {Number} produto_id
 * @property {String} produto_nome
 * @property {String} produto_conteudo
 * @property {Number} produto_valor
 */

/**
 * @typedef {Object} Carrinho
 * @property {String} server_id
 * @property {String} user_id
 * @property {String} msg_carrinho_status
 * @property {ProdutoCarrinho[]} produtos
 */

/**
 * @param {ButtonInteraction} interaction
 */
const gerarPagamento = async (interaction) => {


    const corEmbedPendente = '#FF0031';
    const corEmbedAprovado = '#3AFF03';

    const canalLogsCompras = interaction.guild.channels.cache.get(canalLogs); // Coloca id do seu canal de compras


    try {

        /** @type {Carrinho} */
        const carrinhoDados = await Carrinho.findOne({
            server_id: interaction.guildId,
            user_id: interaction.user.id,
        });


        const quantidade = carrinhoDados.produtos.length;

        if (quantidade < 1) return interaction.reply('Não tem nada no carrinho!')
            .then(() => {

                setTimeout(() => {
                    interaction.deleteReply();
                }, 10_000);
            });


        const valor = carrinhoDados.produtos
            .map(p => p.produto_valor * 100)
            .reduce((acc, curr) => acc + curr) / 100;

        const nomesProdutos = [...new Set(carrinhoDados.produtos
            .map(p => p.produto_nome)) ].join(' | ');

        const conteudoProdutos = carrinhoDados.produtos
            .sort((a, b) => a.produto_id - b.produto_id)
            .map((produto, index) => `${index + 1} ${produto.produto_conteudo}`);


        const aguardandoPagamentoRow = interaction.message.components[0];
        
        aguardandoPagamentoRow.components[0]
            .setLabel('Aguardando pagamento')
            .setEmoji('⏳')
            .setDisabled(true);


        await interaction.update({ components: [ aguardandoPagamentoRow ] });

        const idMsgsProduto = carrinhoDados.produtos.map(p => p.msg_produto_id);

        const msgsProduto = (await interaction.channel.messages.fetch())
            .filter(msg => idMsgsProduto.includes(msg.id));


        interaction.channel.bulkDelete(msgsProduto).catch(() => {});


        const msgsApagar = [];

        const email = 'emailquaquer@sla.com'; // Email qualquer aqui

        const payment_data = {
            transaction_amount: valor,
            description: nomesProdutos,
            payment_method_id: 'pix',
            payer: {
                email,
                first_name: `${interaction.user.tag} (${interaction.user.id})`,
            }
        };


        const data = await mercadopago.payment.create(payment_data);                    
        const base64_img = data.body.point_of_interaction.transaction_data.qr_code_base64;

        const buf = Buffer.from(base64_img, 'base64');
        const attachment = new MessageAttachment(buf, 'qrcode.png');

        const embedQR = new MessageEmbed()
            .setDescription(
                `**✅ Pagamento PIX gerado com o valor de R$ ${payment_data.transaction_amount}\n`+
                'Você pode pagar pelo QrCode ou PIX Copia e cola\nQR Code:**\n'+
                'Clique no botão para PIX Copia e cola'
            )
            .setImage('attachment://qrcode.png');


        const dadosEmbed =
            `Valor a ser pago: "R$ ${valor.toFixed(2)}"\n`+
            `Itens: "${nomesProdutos}"\n`+
            `Quantidade de produtos: "${quantidade}"\n`+
            `Cliente: ${interaction.user.tag} (${interaction.user.id})`;


        await Pagamento.create({
            _id: parseInt(data.body.id),
            server_id: interaction.guildId,
            user_id: interaction.user.id,
            pagamento_confirmado: false,
        });


        const rowCopiaCola = new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setLabel('PIX Copia e cola')
                    .setStyle('PRIMARY')
                    .setCustomId('botao_copia_cola')
            );


        interaction.followUp({
            embeds: [ embedQR ],
            files: [ attachment ],
            fetchReply: true,
            components: [ rowCopiaCola ]
        }).then(m => msgsApagar.push(m.id));


        const coletorCopiaCola = interaction.channel.createMessageComponentCollector(
            {
                componentType: 'BUTTON',
                time: 10 * 60 * 1000,
                filter: i => i.user.id === interaction.user.id && i.customId === 'botao_copia_cola',
            });


        coletorCopiaCola.on('collect', async i => {

            i.channel.send({
                content: `${data.body.point_of_interaction.transaction_data.qr_code}`,
            }).then(m => msgsApagar.push(m.id));

            rowCopiaCola.components[0].setDisabled(true);

            await i.update({ components: [ rowCopiaCola ] });

        });


        canalLogsCompras
            ?.send({ embeds: [
                new MessageEmbed()
                    .setTitle('Novo pagamento')
                    .setDescription(dadosEmbed+'\nStatus Pagamento: "Pendente"')
                    .addField('ID pagamento', `${data.body.id}`)
                    .setColor(corEmbedPendente)
            ] });


        let tentativas = 0;
        const interval = setInterval(async () => {
            // Verificando se foi pago automaticamente
            // console.log('tentativa: ', tentativas+1);
            tentativas++;

            const res = await mercadopago.payment.get(data.body.id);
            const pagamentoStatus = res.body.status;

            if (tentativas >= 8 || pagamentoStatus === 'approved') {

                clearInterval(interval);

                if (pagamentoStatus === 'approved') {

                    aguardandoPagamentoRow.components[0]
                        .setStyle('SUCCESS')
                        .setEmoji('✅')
                        .setLabel('Pagamento aprovado');

                    aguardandoPagamentoRow.components.splice(1, 1);


                    interaction.message.edit({ components: [
                        aguardandoPagamentoRow
                    ] });


                    interaction.channel.bulkDelete(msgsApagar).catch(() => {});

                    canalLogsCompras
                        ?.send({
                            embeds: [
                                new MessageEmbed()
                                    .setTitle('Pagamento Atualizado')
                                    .setDescription(dadosEmbed+'\nStatus Pagamento: "Aprovado"')
                                    .addField('ID pagamento', `${data.body.id}`)
                                    .setColor(corEmbedAprovado)
                            ]
                        });


                    await Pagamento.updateOne({ _id: Number(data.body.id) }, {
                        pagamento_confirmado: true,
                        data: res.body.date_approved,
                        quantidade_produtos_vendidos: quantidade,
                        valor,
                    });


                    /** @type {Collection<Number,ProdutoCarrinho[]>} */
                    const produtosVendidosCollection = new Collection();


                    carrinhoDados.produtos.forEach(p => {
                        produtosVendidosCollection.get(p.produto_id)?.push(p) || produtosVendidosCollection.set(p.produto_id, [p]);
                    });


                    for (const [ id, produtos ] of produtosVendidosCollection) {

                        await ProdutoVendido.insertMany(produtos.map(i => (
                            {
                                server_id: interaction.guildId,
                                quantidade: produtos.length,
                                data: new Date(res.body.date_approved).getTime(),
                                id,
                                nome: i.produto_nome,
                            })
                        ));
                    }


                    const tamanhoConteudo = conteudoProdutos.join('\n').length;

                    if (tamanhoConteudo < 2000) {

                        interaction.channel.send(`\`${conteudoProdutos.join('\n')}\``)
                            .then(async () => {
                                await Carrinho.deleteOne({
                                    server_id: interaction.guildId,
                                    user_id: interaction.member.id
                                });
                                await interaction.channel.setTopic(`Carrinho desativado de ${interaction.user.tag}`);
                            }
                            );
                        return;
                    }

                    // Entrega de produtos que ultrapassem 2048 caracteres do Discord NÂO TESTADA

                    const [ conteudoSeparadoP1, conteudoSeparadoP2 ] = [
                        conteudoProdutos.slice(0, conteudoProdutos.length / 2),
                        conteudoProdutos.slice(conteudoProdutos.length / 2)
                    ];

                    await interaction.channel.send(conteudoSeparadoP1.join('\n'));
                    interaction.channel.send(conteudoSeparadoP2.join('\n'))
                        .then(async () => {
                            await Carrinho.deleteOne({ server_id: interaction.guildId, user_id: interaction.member.id });
                            await interaction.channel.setTopic(`Carrinho desativado de ${interaction.user.tag}`);
                        })
                        .catch(() => interaction.channel.send('Erro ao entregar os itens, contate um staff'));


                }

                else if (pagamentoStatus !== 'approved') {
                    interaction.channel.send({
                        content: `${interaction.user}, caso seu produto não foi entregue automaticamente, clique no botao abaixo para verificar o pagamento`,
                        components: [
                            new MessageActionRow()
                                .addComponents(
                                    new MessageButton()
                                        .setCustomId(`verificar-${data.body.id}`)
                                        .setStyle('PRIMARY')
                                        .setLabel('Verificar')
                                )
                        ]
                    });
                }


            }
        }, 30_000);

    }
    catch (error) {
        
        const msgErro = { content: 'Erro ao processar os dados' };
        interaction.channel.send(msgErro);
        console.log(error);
    }

};

module.exports = { gerarPagamento };

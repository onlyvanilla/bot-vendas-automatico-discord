/* eslint-disable no-useless-escape */
// eslint-disable-next-line no-unused-vars
const { Message, MessageActionRow, MessageButton, MessageEmbed, MessageSelectMenu, TextChannel } = require('discord.js');
const { Produto, MsgProduto, ProdutoEstoque } = require('../../models/vendas');

/**
* @param { Message } message
* @param { string[] } args
*/
const run = async (client, message) => {

    message.delete();

    /** @type {{ _id: Number, nome: String, server_id: String, valor: Number, quantidade: Number }[]} */
    const produtos = await Produto.find({ server_id: message.guildId });

    if (produtos.length < 1) return message.channel.send('Sem produtos cadastrados, use `cadastrarproduto`');

    const menuRow = new MessageActionRow()
        .addComponents(
            new MessageSelectMenu()
                .setCustomId('menu_produtos')
                .setPlaceholder('Selecione um item para salvar aqui')
                .addOptions(produtos
                    .map(produto => ({

                        label: produto.nome,
                        value: `${produto._id}`,
                        description: `Valor R$ ${produto.valor}`,
                    })
                    )
                )
        );

    const msgMenu = await message.channel.send({ components: [menuRow] });

    const menuCollector = message.channel.createMessageComponentCollector({
        filter: i => i.customId === 'menu_produtos',
        componentType: 'SELECT_MENU',
        max: 1,
        idle: 120_000
    });

    menuCollector.on('collect', async i => {

        const itemSelecionado = produtos.find(p => `${p._id}` === i.values[0]);

        // console.log(itemSelecionado);

        const filtroBuscaProduto = {
            produtoId: itemSelecionado._id,
            server_id: message.guildId
        };

        itemSelecionado.quantidade = await ProdutoEstoque.countDocuments(filtroBuscaProduto);

        await Produto.updateOne(filtroBuscaProduto, { quantidade: itemSelecionado.quantidade });

        const embed = new MessageEmbed()
            .setColor('#282C34')
            .setDescription(
                `\`\`\`\✅ ${itemSelecionado.nome}\`\`\`\n`+
            `\n💎 | **Nome:** ${itemSelecionado.nome}\n💵 | **Preço:** ${itemSelecionado.valor}\n📦 | **Stock:** ${itemSelecionado.quantidade}`
            );

        const row = new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setStyle('SUCCESS')
                    .setEmoji('💵')
                    .setCustomId(`pix-${itemSelecionado._id}`)
                    .setLabel('Comprar item')
            );

        const filtroBuscaMsg = { produtoId: itemSelecionado._id, server_id: message.guildId };

        /** @type {{canal_id: String, msg_id: String, server_id: String, produtoId: Number}} */
        const msgProduto = await MsgProduto.findOne(filtroBuscaMsg);

        await i.deferUpdate();

        if (msgProduto) {

            try {
                /** @type {TextChannel} */
                const canal = message.guild.channels.cache.get(msgProduto.canal_id);
                const msgRegistrada = await canal?.messages.fetch(msgProduto.msg_id);

                await i.followUp({ content: `Esse item já está cadastrado [aqui](${msgRegistrada.url})`, ephemeral: true });
                await msgMenu.delete();
                return;
            }
            catch (error) {

                await i.followUp({ content: 'Mensagem ou canal não encontrados, removido do banco... Tente executar novamente', ephemeral: true });
                await MsgProduto.deleteOne(filtroBuscaMsg);
                msgMenu.delete().catch(() => {});
                return;
            }

        }

        const msgProdutoFinal = await message.channel.send({ components: [row], embeds: [embed] });

        await MsgProduto.create({
            canal_id: message.channelId,
            msg_id: msgProdutoFinal.id,
            server_id: message.guildId,
            produtoId: itemSelecionado._id,
        });

        await i.followUp({ content: 'Salvo com sucesso', ephemeral: true });
        msgMenu.delete();


    });

};


module.exports = {	
    run,
    name: 'exibirproduto',
};

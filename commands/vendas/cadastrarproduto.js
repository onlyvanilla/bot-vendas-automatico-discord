// eslint-disable-next-line no-unused-vars
const { Message, Modal, TextInputComponent, MessageActionRow, MessageButton, MessageEmbed } = require('discord.js');
const { Produto } = require('../../models/vendas');
/**
* @param { Message } message
* @param { string[] } args
*/
const run = async (client, message) => {

    if (!message.member.permissions.has('ADMINISTRATOR')) return message.channel.send('Você não tem a permissão para usar isso');

    message.delete();
    const row = new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setCustomId('novo')
                .setEmoji('➕')
                .setStyle('SUCCESS')
        );

    await message.channel.send({ content: 'Clique no botão para adicionar', components: [row] });

    const i = await message.channel.awaitMessageComponent({
        filter: i => i.user.id === message.author.id,
        componentType: 'BUTTON'
    });

    const modal = new Modal()
        .setCustomId('novo_produto')
        .setTitle('Novo produto');

    const nomeInput = new TextInputComponent()
        .setCustomId('nome_produto')
        .setLabel('Qual será o nome do produto?')
        .setRequired(true)
        .setMaxLength(50)
        .setStyle('SHORT');

    const valorInput = new TextInputComponent()
        .setCustomId('valor_produto')
        .setLabel('Valor do produto em reais e centavos')
        .setRequired(true)
        .setMaxLength(50)
        .setStyle('SHORT')
        .setPlaceholder('15,00');

    modal.addComponents(
        new MessageActionRow().addComponents(nomeInput),
        new MessageActionRow().addComponents(valorInput),
    );

    i.showModal(modal);

    const modalInteraction = await i.awaitModalSubmit({ filter: i => i.user.id === message.author.id, time: 120_000 });

    const nome = modalInteraction.fields.getTextInputValue('nome_produto');
    const valor = modalInteraction.fields.getTextInputValue('valor_produto');

    await Produto.create({
        server_id: message.guildId,
        // eslint-disable-next-line no-useless-escape
        valor: Number(valor.replace(',', '.').replace(/[^\d\.]+/g, '')),
        nome,
    });


    const embed = new MessageEmbed()
        .setTitle('Novo produto cadastrado')
        .setColor('#2F3136')
        .addField(nome, `Valor R$ ${valor}`);

    modalInteraction.reply({ embeds: [ embed ], ephemeral: true });
};


module.exports = {
    run,
    name: 'cadastrarproduto',
};

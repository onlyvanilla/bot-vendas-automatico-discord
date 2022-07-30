/* eslint-disable no-useless-escape */
const {
    // eslint-disable-next-line no-unused-vars
    Message, MessageEmbed, MessageActionRow, MessageSelectMenu, ButtonInteraction,
    MessageButton, Modal, TextInputComponent
} = require('discord.js');
const { Produto, ProdutoEstoque, MsgProduto, ProdutoVendido } = require('../../models/vendas');

/**
 * @typedef {Object} Produto
 * @property {Number} _id
 * @property {String} nome
 * @property {String} server_id
 * @property {Number} valor
 * @property {Number} quantidade
 */

/**
 * @typedef {Object} MsgProduto
 * @property {String} canal_id
 * @property {String} msg_id
 * @property {String} server_id
 * @property {Number} produtoId
 */

/**
 * @typedef {Object} ProdutoEstoque
 * @property {Number} produtoId
 * @property {String} server_id
 * @property {String} conteudo
 * @property {Number} data_adicao
 */

/**
 * @param { Message } message
 * @param { string[] } args
 */
const run = async (client, message) => {

    if (!message.member.permissions.has('ADMINISTRATOR')) return message.channel.send(`${message.member}, você não tem permissão de usar esse comando`);

    message.delete().catch(() => {});

    /** @type {Produto[]} */
    const itens = await Produto.find({ server_id: message.guildId });
    let itemAtual = itens.find(() => {}); // So pra pegar a tipagem

    if (itens.length < 1) return message.channel.send('Sem itens cadastrados para adicionar, use `cadastrarproduto`');

    const rowMenu = new MessageActionRow()
        .addComponents(
            new MessageSelectMenu()
                .setCustomId('edicao_produtos_menu')
                .setPlaceholder('Selecione algum item para editar')
                .addOptions(
                    itens.map(item => (
                        {
                            label: `${item.nome} (R$ ${item.valor})`,
                            value: `${item._id}`
                        }
                    ))
                ),
        );

    const botaoAdd = new MessageButton()
        .setLabel('Adicionar estoque')
        .setCustomId('btn_add')
        .setStyle('SUCCESS');

    const botaoEdit = new MessageButton()
        .setLabel('Editar produto')
        .setCustomId('btn_edit')
        .setStyle('PRIMARY');

    const botaoGerenciarEstoque = new MessageButton()
        .setLabel('Gerenciar estoque')
        .setCustomId('gerenciar_estoque')
        .setStyle('SECONDARY');


    const rowBotoes = new MessageActionRow()
        .addComponents(
            botaoAdd,
            botaoEdit,
            // botaoDel,
            botaoGerenciarEstoque,
        );

    

    const msgMenu = await message.channel.send({
        embeds: [ gerarEmbedEditando() ],
        components: [ rowMenu, rowBotoes ]
    });

    const coletor = message.channel.createMessageComponentCollector({
        filter: i => [ 'edicao_produtos_menu', 'btn_add', 'btn_del', 'btn_edit', 'gerenciar_estoque' ].includes(i.customId),
        idle: 5 * 60 * 1_000
    });


    coletor.on('collect', async interaction => {

        if (interaction.user.id !== message.member.id) return interaction.deferUpdate();

        if (interaction.isSelectMenu()) {

            const [ itemId ] = interaction.values;
            const itemEscolhido = itens.find(i => `${i._id}` === itemId);
            itemEscolhido.quantidade = await ProdutoEstoque.countDocuments({
                server_id: message.guildId,
                produtoId: itemEscolhido._id,
            });

            itemAtual = itemEscolhido;

            const embed = gerarEmbedEditando(
                itemEscolhido.nome,
                formatarValor(itemEscolhido.valor),
                itemEscolhido.quantidade
            );

            interaction.update({ embeds: [ embed ] });
            return;
        }

        else if (interaction.isButton()) {

            if (!itemAtual) return interaction.reply('Selecione um item do menu antes')
                .then(() => {
                    setTimeout(() => interaction.deleteReply().catch(() => {}), 15_000);
                });

            if (interaction.customId === 'btn_add') {

                try {

                    const modalInteraction = await criarModal(interaction, message);

                    const conteudo = modalInteraction.fields.getTextInputValue('conteudo');
                
                    await modalInteraction.reply({ content: 'Processando...', ephemeral: true });

                    const filtroBusca = {
                        produtoId: itemAtual._id,
                        server_id: message.guildId,
                    };


                    await ProdutoEstoque.create({
                        ...filtroBusca,
                        conteudo,
                        data_adicao: Date.now(),
                    });

                    const quantidadeItens = await ProdutoEstoque.countDocuments(filtroBusca);
                    itemAtual.quantidade = quantidadeItens;

                    await Produto.updateOne({ _id: itemAtual._id }, { quantidade: itemAtual.quantidade });

                    await modalInteraction.editReply({ content: 'Salvo com sucesso ✅', ephemeral: true });


                    interaction.message.edit({ embeds: [ gerarEmbedEditando(
                        itemAtual.nome,
                        formatarValor(itemAtual.valor),
                        itemAtual.quantidade
                    ) ] });

                    await atualizarBannerProduto(interaction, message, itemAtual);

                }
                catch(err) {
                    console.log(err);
                }
            }
            ////////////////////////////////////////////

            else if (interaction.customId === 'btn_edit') {

                const modalInteraction = await criarModal(interaction, message);

                const [ nome, valor ] = [ 'nome', 'valor' ].map(customId => modalInteraction
                    .fields.getTextInputValue(customId)
                );

                if (!nome && !valor) return modalInteraction
                    .reply('Nenhum campo foi preenchido, nada foi alterado')
                    .then(() => {
                        setTimeout(() => modalInteraction.deleteReply().catch(() => {}), 20_000);
                    });

                const dadosAtualizar = {};

                const valorFmt = Number(valor?.replace(',', '.'));

                if (valor && !valorFmt) return modalInteraction
                    .reply('Valor no formato inválido, tente usar algo no formato `5`, ou `2,50`')
                    .then(() => {
                        setTimeout(() => modalInteraction.deleteReply().catch(() => {}), 20_000);
                    });

                if (nome) dadosAtualizar.nome = nome;
                if (valor) dadosAtualizar.valor = valorFmt;

                const dadosAlterados = Object.keys(dadosAtualizar)
                    .map(k => `${k} alterado para \`${dadosAtualizar[k]}\``)
                    .join('\n');

                await modalInteraction.reply(dadosAlterados)
                    .then(() => 
                        setTimeout(() => modalInteraction
                            .deleteReply().catch(() => {}),
                        15_000
                        )
                    );

                /** @type {Produto}*/
                const produtoAtualizado = await Produto.findOneAndUpdate(
                    {
                        _id: itemAtual._id,
                        server_id: itemAtual.server_id,
                    },
                    {
                        ...dadosAtualizar
                    },
                    {
                        returnDocument: 'after'
                    }
                    
                );

                itemAtual = produtoAtualizado;

                interaction.message.edit({ embeds: [ gerarEmbedEditando(
                    itemAtual.nome,
                    formatarValor(itemAtual.valor),
                    itemAtual.quantidade
                ) ] });

                await atualizarBannerProduto(interaction, message, itemAtual);

                if (nome) await ProdutoVendido.updateMany(
                    {
                        server_id: itemAtual.server_id,
                        id: itemAtual._id,
                    },
                    {
                        nome
                    }
                );


                return;
            }
            ////////////////////////////////////////////


            else if (interaction.customId === 'gerenciar_estoque') {

                gerenciarEstoque(interaction, itemAtual);
                return;
            }
        }
    });

    coletor.on('end', () => {
        msgMenu.delete().catch(() => {});
    });
};

/** @param { ButtonInteraction } interaction */
const criarModal = async (interaction, message) => {

    let modal;
    const inputs = [];

    if (interaction.customId === 'btn_add') {

        modal = new Modal()
            .setCustomId('novo_item')
            .setTitle('Adicionando estoque');

        const conteudoInput = new TextInputComponent()
            .setCustomId('conteudo')
            .setLabel('O que será entregue à quem comprar?')
            .setRequired(true)
            .setStyle('PARAGRAPH');

        inputs.push(
            new MessageActionRow()
                .addComponents(conteudoInput)
        );
    }

    else {

        modal = new Modal()
            .setCustomId('editar_item')
            .setTitle('Editando dados do produto');


        const nomeInput = new TextInputComponent()
            .setCustomId('nome')
            .setLabel('Novo nome do produto (opcional)')
            .setStyle('SHORT');

        const valorInput = new TextInputComponent()
            .setCustomId('valor')
            .setLabel('Novo valor do produto (opcional)')
            .setStyle('SHORT');

        [ nomeInput, valorInput ].forEach(i => {

            inputs.push(
                new MessageActionRow()
                    .addComponents(i)
            );
        });

    }

    modal.addComponents(inputs);


    await interaction.showModal(modal);

    return await interaction.awaitModalSubmit({
        filter: i => i.user.id === message.author.id,
        time: 120_000
    });
};


const atualizarBannerProduto = async (interaction, message, itemAtual) => {

    /** @type {MsgProduto} */
    const msgProduto = await MsgProduto.findOne({ server_id: message.guildId, produtoId: itemAtual._id });

    if (!msgProduto) return;

    /** @type {TextChannel} */
    const canal = message.guild.channels.cache.get(msgProduto.canal_id);
    if (!canal) return interaction.followUp({ content: `Canal de atualizar estoque de ${itemAtual.nome} não encontrado`, ephemeral: true });


    canal.messages.fetch(msgProduto.msg_id)
        .then(async m => {
            await m.edit({ embeds: [setEmbedBannerProduto(itemAtual)] });
            interaction.followUp({ content: 'Mensagem de estoque de produto atualizada com sucesso', ephemeral: true });
        })
        .catch(() => interaction.followUp(
            {
                content: 'Erro ao atualizar mensagem de estoque de produto',
                ephemeral: true
            }
        ));

};


const setEmbedBannerProduto = (itemAtual) => new MessageEmbed()
    .setColor('#282C34')
    .setDescription(
        `\`\`\`\✅ ${itemAtual.nome}\`\`\`\n`+
`\n💎 | **Nome:** ${itemAtual.nome}\n💵 | **Preço:** ${itemAtual.valor}\n📦 | **Stock:** ${itemAtual.quantidade}`
    );


const gerarEmbedEditando = (nome = 'Nenhum', valor = '---', quantidade = '--') => new MessageEmbed()
    .setTitle('Edição de produtos')
    .setColor('#2f3136')
    .setDescription(
        `Atual produto: \`${nome}\`\n`+
            `Valor: \`${valor}\`\n`+
            `Quantidade em estoque: \`${quantidade}\``
    );


const formatarValor = numero => `R$ ${numero.toFixed(2).replace('.', ',')}`;

/**
 * @param {ButtonInteraction} interaction 
 * @param {Produto} itemAtual 
 */
const gerenciarEstoque = async (interaction, itemAtual) => {

    /** @type {ProdutoEstoque[]} */
    const estoque = await ProdutoEstoque.find({
        server_id: itemAtual.server_id,
        produtoId: itemAtual._id,
    })
        .sort({ data_adicao: -1 });

    if (estoque.length < 1) return interaction.reply('Estoque vazio');

    let posicaoItem = 0;

    const proximoBotao = new MessageButton()
        .setStyle('SECONDARY')
        .setCustomId('next')
        .setEmoji('▶️');

    const anteriorBotao = new MessageButton()
        .setStyle('SECONDARY')
        .setCustomId('prev')
        .setEmoji('◀️');

    const apagarBotao = new MessageButton()
        .setStyle('DANGER')
        .setCustomId('delete')
        .setEmoji('🗑');

    const row = new MessageActionRow()
        .addComponents(
            anteriorBotao,
            proximoBotao,
            apagarBotao
        );


    const coletorPagina = interaction.channel.createMessageComponentCollector({
        componentType: 'BUTTON',
        filter: i => [ 'next', 'prev', 'delete' ].includes(i.customId),
        time: 10 * 60_000,
        idle: 120_000,
    });


    const esconderTexto = texto => texto
        .split('')
        .map((item, index) => index < 5 && item)
        .join('')
        .replaceAll('false', '#');


    /**
     * @param {Produto} produto
     * @param {ProdutoEstoque[]} todosProdutos
     * @param {ProdutoEstoque} produtoEstoque
     */
    const gerarPagina = (produto = itemAtual, todosProdutos = estoque, produtoEstoque = estoque[posicaoItem]) => new MessageEmbed()
        .setColor('#2f3136')
        .setTitle(produto.nome)
        .setDescription(
            `${esconderTexto(produtoEstoque.conteudo)}\n`+
            `Adicionado em ${
                new Date(produtoEstoque.data_adicao)
                    .toLocaleString('pt-br')
            }`
        )
        .setFooter({ text: `${todosProdutos.indexOf(produtoEstoque) + 1}/${todosProdutos.length}` });


    await interaction.reply({
        embeds: [ gerarPagina() ],
        components: [ row ]
    });

    coletorPagina.on('collect', async i => {

        if (i.user.id !== interaction.user.id) return interaction.reply('https://cdn.discordapp.com/attachments/803646280492515390/993285687308718163/unknown.png');

        if (i.customId === 'prev') {

            if (posicaoItem - 1 < 0) return i.deferUpdate();
            posicaoItem--;

        }
        else if (i.customId === 'next') {

            if (posicaoItem + 1 >= estoque.length) return i.deferUpdate();
            posicaoItem++;

        }
        else if (i.customId === 'delete') {

            const itemRemovido = estoque[posicaoItem];

            estoque.splice(estoque.indexOf(itemRemovido), 1);
            itemAtual.quantidade--;

            await ProdutoEstoque.deleteOne({
                server_id: itemRemovido.server_id,
                produtoId: itemRemovido.produtoId,
                conteudo: itemRemovido.conteudo,
            });


            await Produto.findOneAndUpdate({
                _id: itemRemovido.produtoId,
                server_id: itemRemovido.server_id,
            },
            {
                quantidade: estoque.length,
            });

            posicaoItem = 0;

            if (itemAtual.quantidade > 0) {
                i.update({ embeds: [ gerarPagina() ] });
            }
            else {
                i.message.delete();
                coletorPagina.stop();
            }

            interaction.message.edit({ embeds: [
                gerarEmbedEditando(
                    itemAtual.nome,
                    formatarValor(itemAtual.valor),
                    itemAtual.quantidade
                )
            ] });
            return atualizarBannerProduto(interaction, interaction.message, itemAtual);

        }

        i.update({ embeds: [ gerarPagina() ] });

    });

};


module.exports = {	
    run,
    name: 'estoque',
};

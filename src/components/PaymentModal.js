import React, { Component, PropTypes } from 'react'
import Icon from 'react-native-vector-icons/FontAwesome'
import { 
  TouchableHighlight, View, Modal, Text, TextInput, StyleSheet, Image, Linking, WebView, Dimensions
} from 'react-native'

import CardDetailsForm from './partials/CardDetailsForm'
import TokenForm from './partials/TokenForm'
import AuthWebView from './partials/AuthWebView'

import RaveApi from '../actions/RaveApi'
import { Section, Button, Input, FadeOutView, Select, CheckBox } from './common'
import { 
  selData, formatCurrencyAmountLabel, formatCardNumber, formatExpiryDate, getQueryParams, 
  SUCCESS, NEED_TO_VALIDATE, VBVSECURECODE, PIN, selResponseAction, selAuthModel, selAuthUrl, 
  selTxnRef, selResponseMessage, selFormTypeFields, selValidationBtnLabel,
} from '../utils'

const dimensions = Dimensions.get('window')

class PaymentModal extends Component {  
  constructor(props) {
    super(props)

    this.state = this._calculateState()
    this._handleCloseModal = this._handleCloseModal.bind(this)
    this._handleCheckBox = this._handleCheckBox.bind(this)
    
  }
  
  componentWillMount() {
    RaveApi.getAllBanks()
    .then(res => {
      this.setState({ banks: res.data })
    })
    .catch(err => {
      throw err
    })
  }
  
  _calculateState() {
    return {
      cardDetails: {},
      accountDetails: {
        accountnumber: null,
        accountbank: null,
        validateoption: null
      },
      validateDetails: {
        otp: null,
        txRef: null
      },      
      banks: [],
      validateOption : [
        { code: 'USSD', name: 'USSD'},
        { code: 'HWTOKEN', name: 'HWTOKEN'}
      ],
      tabs: ['CARD', 'ACCOUNT'],
      currentTab: 'CARD',
      loading: false,
      errorMessage: null,
      transactionError: false,
      transactionInfo: false,
      transactionMsg: null,
      useToken: false,
      rememberMe: false,
      needsValidation: false,
      authModel: null,
      authUrl: null
    }
  }
  
  _handleSuccessfulPayment(res) {
    return (selResponseAction(res.data) === SUCCESS)
    ? this._handleTxnComplete(res.data)
    : this._handleValidateTxn(res.data)
  }

  _handleTxnComplete(data) {
    const { rememberMe, currentTab } = this.state
    let transactionMsg = selResponseMessage(data)
    
    if (rememberMe && currentTab === 'CARD') {
      transactionMsg = selChargeToken(data)
    }

    this.setState({
      loading: false,
      transactionMsg,
      transactionInfo: true
    })    
  }

  _handleValidateTxn(data) {
    const needsValidation = (selResponseAction(data) == NEED_TO_VALIDATE)
    const authModel = selAuthModel(data)
    const authUrl = selAuthUrl(data)
    const txRef = selTxnRef(data)
    const authView = (authModel === VBVSECURECODE)

    this.setState({ 
      needsValidation, 
      authModel, 
      authUrl,
      authView,
      loading: false,
      validateDetails: { ...this.state.validateDetails, txRef }
    })
  }
  
  _handleFailedPayment(error) {
    this.setState({ 
      loading: false, 
      transactionError: true,
      errorMessage: error
    })
  }

  _processCardPayment() {
    const { cardDetails } = this.state
    const data = selData(this.props)
    return RaveApi.chargeCard({ ...cardDetails, ...data })
    .then(res => this._handleSuccessfulPayment(res))
    .catch(err => this._handleFailedPayment(err))    
  }
  
  _processAccountpayment() {
    const { accountDetails } = this.state;
    const data = selData(this.props)
    return RaveApi.chargeAccount({ ...accountDetails, ...data })
    .then(res => this._handleSuccessfulPayment(res))
    .catch(err => this._handleFailedPayment(err)) 
  }

  _processValidateCharge() {
    const { PBFPubKey } = this.props
    const { validateDetails } = this.state
    return RaveApi.validateCharge({ ...validateDetails, PBFPubKey })
    .then(res => return this._handleSuccessfulPayment(res))
    .catch(err => this._handleFailedPayment(err)) 
  }
    
  _handlePaymentRequest = () => {
    const { currentTab, needsValidation } = this.state
    this.setState({ loading: true })

    return needsValidation
    ? this._processValidateCharge()
    : (currentTab === 'CARD'
        ? this._processCardPayment()
        : this._processAccountpayment()
      )
  }

  _handleCloseModal() {
    this.setState(
      { ...this._calculateState()}, 
      this.props.onRequestClose()
    )
  }

  _handleCheckBox(key) {
    this.setState({ [key]: !this.state[key] })
  }
  
  _onSelectTab = (tab) => {
    return this.setState({ currentTab: tab, transactionMsg: null })
  }
  
  _onSelectChange(key, value) {
    const accountDetails = { ...this.state.accountDetails, [key]: value };
    this.setState({ accountDetails })    
  }
  
  _resetErrorNotification = () => {
    this.setState({ transactionError: false, errorMessage: null })
  }
  
  _resetInfoNotification = () => {
    this.setState({ transactionInfo: false })
  }

  _handleCardDetails(key, value) {
    const cardDetails = { ...this.state.cardDetails, [key]: value };
    this.setState({ cardDetails })
  }
  
  _handleAccountDetails(key, value) {
    const accountDetails = { ...this.state.accountDetails, [key]: value }
    this.setState({ accountDetails })    
  }

  _handleValidateDetails(key, value) {
    const validateDetails = { ...this.state.validateDetails, [key]: value }
    this.setState({ validateDetails })
  }

  _handleChange(prop, key, value) {
    const propVal = { ...this.state[prop], [key]: value }
    this.setState({ [prop]: propVal })
  }

  _handleNavChange = (url) => {
    isComplete = url.includes(RaveApi.RootUrl)
    this.setState({ 
      authView: !isComplete,
      transactionMsg: isComplete ? 'Approved. Successful' : null,
      transactionInfo: true
    })
  }
  
  renderPaymentInfo() {
    const { description, title } = this.props
    return (
      <View style={styles.paymentSummary}>
        <Image style={styles.image} source={require('../assets/defaultLogo.jpg')}/>
        <Text style={styles.paymentTitle}>{title}</Text>
        <Text style={styles.paymentDescription}>{description}</Text>
        <Text style={styles.totalAmount}>{formatCurrencyAmountLabel(this.props)}</Text>
      </View>
    )  
  }
  
  renderPaymentTab() {
    const { tabs, currentTab } = this.state;
    return(
      <Section>
        {tabs.map(tab => {
          const activeTab = (currentTab === tab) ? styles.activeTab : {};
          return (
            <Text 
              key={tab} 
              onPress={this._onSelectTab.bind(this, tab)} 
              style={[styles.tab, activeTab]}>
              <Icon name={`${tab === 'CARD' ? 'credit-card-alt' : 'university'}`}/>
              &emsp;{tab}
            </Text>
          )
        })}
      </Section>
    )
  }

  renderUseToken() {
    const { useToken } = this.state;
    return (
      <Section>
        <View style={styles.useTokenContainer}>
          <CheckBox
            onChange={this._handleCheckBox.bind(this, 'useToken')}
            isChecked={useToken}
            leftText={'Use Token'}
          />
        </View>
      </Section>
    );
  }
  
  renderUseTokenForm() {
    return (
      <TokenForm onInputChange={this._handleCardDetails.bind(this)} />
    )
  }

  renderUseCardDetailsForm() {
    const { authModel } = this.props
    return (
      <CardDetailsForm
        authModel={authModel}
        onInputChange={this._handleCardDetails.bind(this)}
        onCheckBoxChange={this._handleCheckBox}
      />
    )
  }

  renderErrorNotification() {
    const { transactionError, errorMessage } = this.state
    return transactionError &&
      <FadeOutView callback={this._resetErrorNotification}>
        <Section>
          <View style={[styles.notification, styles.errorNotification]}>
            <Text style={styles.notificationText}>{errorMessage}</Text>
          </View>
        </Section>
      </FadeOutView>
  }
  
  renderInfoNotification() {
    const { transactionInfo, transactionMsg } = this.state
    return transactionInfo &&
      <Section>
        <View style={[styles.notification, styles.infoNotification]}>
          <Text style={styles.notificationText}>{transactionMsg}</Text>
        </View>
      </Section>
  }

  renderValidationFields() {
    const { authModel, validateDetails } = this.state
    const formFields = selFormTypeFields(authModel)
    return (
      <View>
        {formFields.map((fieldObj, key) => {
          const { field, placeholder } = fieldObj
          return (
            <Section key={key}>
              <Input
                ref={key}
                placeholder={placeholder}
                value={validateDetails[field]}
                onChangeText={this._handleChange.bind(this, 'validateDetails', field)}
                maxLength={19}
                onSubmitEditing={() => this._focusNextField(key)}
              />
            </Section>
          )
        })}
      </View>
    )    
  }

  renderAuthWebView() {
    const { authUrl, authView } = this.state
    return (
      <AuthWebView 
        url={authUrl} 
        visible={authView}
        dimensions={dimensions}
        onNavChange={this._handleNavChange}
      />     
    )
  }

  renderValidationFormType() {
    const { authModel, validateDetails } = this.state
    const formFields = selFormTypeFields(authModel)
    return (
      <View>
        {formFields.map((fieldObj, key) => {
          const { field, placeholder } = fieldObj
          return (
            <Section key={key}>
              <Input
                ref={key}
                placeholder={placeholder}
                value={validateDetails[field]}
                onChangeText={this._handleValidateDetails.bind(this, field)}
                maxLength={19}
              />
            </Section>
          )
        })}
      </View>
    )     
  }
  
  renderCardForm() {
    const { useToken, needsValidation } = this.state;
    return (
      <View>
        {needsValidation 
          ? this.renderValidationFormType()
          : (
            <View>
              {this.renderUseToken()}
              {useToken
                ? this.renderUseTokenForm()
                : this.renderUseCardDetailsForm()
              }
            </View>
          )
        }
      </View>
    )
  }
  
  renderAccountForm() {
    const { banks, validateOption, accountDetails: { accountnumber } } = this.state
    return (
      <View>
        <Section>
          <Input
            placeholder='Account Number'
            value={accountnumber}
            onChangeText={this._handleChange.bind(this, 'accountDetails', 'accountnumber')}
          />        
        </Section>
        <Section>
          <Select
            defaultLabel={'SELECT BANK'}
            options={banks}
            changeValue={this._handleChange.bind(this, 'accountDetails', 'accountbank')}
          />
        </Section>
        <Section>
          <Select
            defaultLabel={'SELECT OTP option'}
            options={validateOption}
            changeValue={this._handleChange.bind(this, 'accountDetails', 'validateoption')}
          />
        </Section>        
      </View>
    )
  }

  renderFormType() {
    const { currentTab, needsValidation } = this.state

    return needsValidation
    ? this.renderValidationFormType()
    : (currentTab === 'CARD' 
      ? this.renderCardForm() 
      : this.renderAccountForm()
    )
  }

  renderButtonType() {
    const { needsValidation, authModel, loading } = this.state
    const label = needsValidation 
    ? selValidationBtnLabel(authModel) 
    : formatCurrencyAmountLabel(this.props)
    return (
      <Section>
        <Button
          labelText={label}
          onPress={this._handlePaymentRequest} 
          loading={loading}
          buttonStyle={styles.payButton}
          buttonTextStyle={styles.payButtonText}
          underlayColor='#127F6A'
        />
      </Section>
    )
  }
  
  renderContent() {
    const { currentTab, loading } = this.state
    return (
      <View>
        {this.renderFormType()}
        {this.renderButtonType()}
      </View>
    )
  }

  renderInfoContent() {
    const { transactionInfo, transactionMsg } = this.state
    return (
      <View>
        {this.renderInfoNotification()}
        <Section>
          <Button 
            labelText={'CLOSE FORM'}
            onPress={this._handleCloseModal}
            buttonStyle={styles.closeButton}
            buttonTextStyle={styles.closeButtonText}
            underlayColor='#C0C0C0'
          />
        </Section>
      </View>
    )
  }
  
  renderPaymentForm() {
    const { transactionMsg } = this.state
    return (
      <View style={[styles.parentSection, styles.paymentForm]}>
        <View style={styles.sectionContainer}>
          {this.renderPaymentTab()}
          {this.renderErrorNotification()}
          { transactionMsg 
            ? this.renderInfoContent() 
            : this.renderContent()
          }
        </View>
      </View>    
    )
  }
  
  renderCloseModalIcon() {
    return (
      <View style={styles.closeModalIconContainer}>
        <TouchableHighlight 
          onPress={this._handleCloseModal}
          underlayColor='transparent'>
          <View>
            <Text>
              <Icon name='times-circle' size={16} color='#DEDEDE'/>
            </Text>
          </View>
        </TouchableHighlight>
      </View>
    )
  }

  render() {
    const { visible, transparent, onRequestClose } = this.props
    return (
      <Modal
        visible={visible}
        transparent={transparent}
        animationType='slide'
        onRequestClose={onRequestClose}>
        {this.state.authView 
          ? this.renderAuthWebView() 
          : <View style={styles.container}>
              <View style={styles.paymentContainer}>
                {this.renderCloseModalIcon()}
                {this.renderPaymentInfo()}
                {this.renderPaymentForm()}
              </View>
            </View>
        }
      </Modal>
    )
  }
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    flex: 1,
    justifyContent: 'center',
    padding: 20
  },
  paymentContainer: {
    backgroundColor: '#FFF', 
    borderRadius: 5
  },
  parentSection: {
    flexDirection: 'row',
    padding: 15
  },
  sectionContainer: {
    flex:1, 
    flexDirection: 'column'
  },
  paymentForm: {
    backgroundColor: '#FBFBFB',
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
    borderTopColor: '#DDD',
    borderTopWidth: 1
  },
  paymentSummary: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15
  },
  inputContainer: {
    flex: 1,
    height: 36
  },
  spacing: {
    marginLeft: 12
  },
  totalAmount: {
    color: '#16A085',
    fontSize: 18
  },
  paymentDescription: {
    fontSize: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    textAlign: 'center'
  },
  paymentTitle: {
    marginTop: 15,
    fontWeight: '500',
    fontSize: 16
  },
  image: {
    height: 50,
    borderRadius: 25,
    width: 50
  },
  tabContainer: {
    flexGrow: 1,
    flexDirection: 'row',
    height: 46 
  },
  tab: {
    borderWidth: 1,
    borderColor: '#E4E4E4',
    backgroundColor: '#FFF',
    flex: 1,
    flexDirection: 'row',
    padding: 15,
    textAlign: 'center'
  },
  activeTab: {
    borderColor: '#372E4C',
    backgroundColor: '#372E4C',
    color: '#FFF'
  },
  notification: {
    flex: 1,
    padding: 15,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center'    
  },
  errorNotification: {
    backgroundColor: '#C0392B'
  },
  infoNotification: {
    backgroundColor: '#2980b9'
  },
  notificationText: {
    textAlign: 'center',
    color: '#FFF'
  },
  payButton: {
    backgroundColor: '#16A085',
    borderColor: '#16A085'    
  },
  payButtonText: {
    color: 'white',
  },
  closeButton: {
    backgroundColor: '#C0C0C0',
    borderColor: '#C0C0C0'    
  },
  closeButtonText: {
    color: 'black',
    fontWeight: '400'
  },
  closeModalIconContainer: {
    alignItems: 'flex-end',
    right: 8,
    top: 8
  },
  checkboxContainer: {
    flex: 1,
    flexDirection: 'row'
  },
  useTokenContainer: {
    flex: 1,
    alignItems: 'flex-end',
    flexDirection: 'row'
  }
})

PaymentModal.propTypes = {
  visible        : PropTypes.bool,
  amount         : PropTypes.number,
  description    : PropTypes.string,
  transparent    : PropTypes.bool,
  onRequestClose : PropTypes.func
}

PaymentModal.defaultProps = {
  transparent: true,
  country    : 'Nigeria',
  currency   : 'NGN'
}

export default PaymentModal

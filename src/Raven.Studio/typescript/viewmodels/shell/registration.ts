import dialogViewModelBase = require("viewmodels/dialogViewModelBase");
import app = require("durandal/app");
import dialog = require("plugins/dialog");

import licenseRegistrationCommand = require("commands/licensing/licenseRegistrationCommand");
import licenseActivateCommand = require("commands/licensing/licenseActivateCommand");

import moment = require("moment");


class registrationModel {
    name = ko.observable<string>();
    email = ko.observable<string>();
    company = ko.observable<string>();

    constructor() {
        this.setupValidation();
    }

    private setupValidation() {
        this.name.extend({
            required: true
        });

        this.email.extend({
            required: true,
            email: true
        });
    }

    toDto() { //TODO: use server side type
        return {
            Name: this.name(),
            Email: this.email(),
            Company: this.company()
        }
    }
}

class licenseKeyModel {

    key = ko.observable<string>();

    constructor() {
        this.setupValidation();
    }

    private setupValidation() {
        this.key.extend({
            required: true
        });
    }
}

class registrationDismissStorage {

    private static readonly storageKey = "registrationDismiss";

    static getDismissedUntil(): Date {
        const storedValue = localStorage.getObject(registrationDismissStorage.storageKey);
        if (storedValue) {
            return new Date(storedValue);
        }

        return null;
    }

    static dismissFor(days: number) {
        localStorage.setObject(registrationDismissStorage.storageKey, moment().add(5, "days").toDate().getTime());
    }

    static clearDismissStatus() {
        localStorage.removeItem(registrationDismissStorage.storageKey);
    }
}

class registration extends dialogViewModelBase {

    isBusy = ko.observable<boolean>(false);
    licenseKeySectionActive = ko.observable<boolean>(false);
    justRegistered = ko.observable<boolean>(false);
    dismissVisible = ko.observable<boolean>(true);

    private registrationModel = ko.validatedObservable(new registrationModel());
    private licenseKeyModel = ko.validatedObservable(new licenseKeyModel());
    private license: licenseStatusDto;

    private hasInvalidLicense = ko.observable<boolean>(false);

    constructor(license: licenseStatusDto, canBeDismissed: boolean) {
        super();
        this.license = license;

        this.dismissVisible(canBeDismissed);
    }

    static showRegistrationDialogIfNeeded(license: licenseStatusDto) {
        if (license.LicenseType === "Invalid") {
            const vm = new registration(license, false);
            app.showBootstrapDialog(vm);
            return;
        }

        if (license.LicenseType === "None") {
            const dismissedUntil = registrationDismissStorage.getDismissedUntil();

            if (!dismissedUntil || dismissedUntil.getTime() < new Date().getTime()) {
                const vm = new registration(license, true);
                app.showBootstrapDialog(vm);
                return;
            }
        }
    }

    dismiss(days: number) {
        registrationDismissStorage.dismissFor(days);
        app.closeDialog(this);
    }

    goToEnterLicense() {
        this.licenseKeySectionActive(true);
    }

    goToRegistration() {
        this.licenseKeySectionActive(false);
    }

    submit() {
        if (this.licenseKeySectionActive()) {
            this.submitLicenseKey();
        } else {
            this.submitRegistration();
        }
    }

    private submitRegistration() {
        if (!this.isValid(this.registrationModel)) {
            return;
        }

        this.isBusy(true);

        new licenseRegistrationCommand(this.registrationModel().toDto())
            .execute()
            .done(() => {
                this.justRegistered(true);
                this.licenseKeySectionActive(true);
            })
            .always(() => this.isBusy(false));
    }

    private submitLicenseKey() {
        if (!this.isValid(this.licenseKeyModel)) {
            return;
        }

        this.isBusy(true);

        new licenseActivateCommand(this.licenseKeyModel().key())
            .execute()
            .done(() => {
                // TODO: on activated action
                // TODO: fetch license status?

                dialog.close(this);
            })
            .always(() => this.isBusy(false));
    }
}

export = registration;


